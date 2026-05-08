const mongoose = require('mongoose');
const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const { validateField, evaluateConditionalLogic, getNextVisibleField } = require('../utils/fieldTypes');
const { evaluateFormVisibility } = require('../utils/formEvaluator');

// Create a new form
const createForm = async (req, res) => {
  try {
    console.log('Backend received payload:', req.body);
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected. Please try again later.',
        error: 'MongoDB connection is not established'
      });
    }

    const { title, description, fields } = req.body;
    console.log('Extracted fields:', fields);
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ message: 'Form title is required' });
    }
    
    // Allow empty fields array for new forms
    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({ message: 'Form fields must be an array' });
    }
    
    // Validate each field only if fields exist
    for (const field of fields) {
      if (!field.type || !field.question) {
        return res.status(400).json({ message: 'Each field must have a type and question' });
      }
      
      // Validate group fields
      if (field.type === 'group' || field.type === 'repeatable_group') {
        console.log('Backend received group field:', field);
        console.log('groupFields:', field.groupFields);
        console.log('groupFields type:', typeof field.groupFields);
        console.log('groupFields isArray:', Array.isArray(field.groupFields));
        console.log('groupFields length:', field.groupFields?.length);
        
        if (!field.groupFields || !Array.isArray(field.groupFields) || field.groupFields.length === 0) {
          return res.status(400).json({ message: 'Group fields must contain at least one field' });
        }
        
        // Validate each field in the group
        for (const groupField of field.groupFields) {
          if (!groupField.type || !groupField.question) {
            return res.status(400).json({ message: 'Each group field must have a type and question' });
          }
          
          // Add order if not provided
          if (!groupField.order) {
            groupField.order = field.groupFields.indexOf(groupField);
          }
        }
      }
      
      // Validate conditional logic
      if (field.conditionalLogic && field.conditionalLogic.enabled) {
        if (!field.conditionalLogic.conditions || !Array.isArray(field.conditionalLogic.conditions)) {
          return res.status(400).json({ message: 'Conditional logic must have conditions array' });
        }
        
        // Only validate non-empty conditions
        for (const condition of field.conditionalLogic.conditions) {
          // Skip validation for empty/incomplete conditions
          if (condition.fieldId && condition.fieldId.trim() !== '') {
            if (!condition.operator) {
              return res.status(400).json({ message: 'Each condition must have an operator when fieldId is specified' });
            }
          }
        }
      }
      
      // Add order if not provided
      if (!field.order) {
        field.order = fields.indexOf(field);
      }
    }
    
    // Create form with authenticated user as creator
    const formData = {
      title,
      description: description || '',
      fields: fields.map((field, index) => {
        const processedField = {
          ...field,
          // Generate ID only if field doesn't have one (new fields)
          id: field.id || new mongoose.Types.ObjectId().toString(),
          order: field.order || index
        };
        
        // Generate IDs for group fields if they don't have them
        if (field.type === 'group' || field.type === 'repeatable_group') {
          processedField.groupFields = field.groupFields.map((groupField, gfIndex) => ({
            ...groupField,
            // Generate ID only if group field doesn't have one (new fields)
            id: groupField.id || new mongoose.Types.ObjectId().toString(),
            order: groupField.order || gfIndex
          }));
        }
        
        return processedField;
      }),
      createdBy: req.user ? req.user.id : null, // Will be null if no auth middleware
    };
    
    const form = new Form(formData);
    const newForm = await form.save();
    
    // Populate creator info
    await newForm.populate('createdBy', 'username email');
    
    res.status(201).json({
      success: true,
      message: 'Form created successfully',
      data: newForm
    });
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create form',
      error: error.message
    });
  }
};

// Get all forms
const getForms = async (req, res) => {
  try {
    const { isPublic } = req.query;
    let filter = {};
    
    // If user is authenticated, only show their forms
    if (req.user && req.user.id) {
      filter.createdBy = req.user.id;
    } else if (!isPublic) {
      // If no user and not requesting public forms, return empty
      return res.json({
        success: true,
        data: []
      });
    }
    
    if (isPublic !== undefined) {
      filter.isPublic = isPublic === 'true';
    }
    
    const forms = await Form.find(filter)
      .populate('createdBy', 'username email')
      .sort({ updatedAt: -1 });
    
    res.json({
      success: true,
      data: forms
    });
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch forms',
      error: error.message
    });
  }
};

// Get form by ID
const getFormById = async (req, res) => {
  try {
    const form = await Form.findById(req.params.id)
      .populate('createdBy', 'username email');
    
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }
    
    res.json({
      success: true,
      data: form
    });
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch form',
      error: error.message
    });
  }
};

// Submit form response with strict security validation
const submitResponse = async (req, res) => {
  try {
    const { formId, respondentEmail, answers } = req.body;
    
    // Validate required fields
    if (!formId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Form ID and answers array are required'
      });
    }
    
    // 1. FETCH SCHEMA: Check if form exists
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }
    
    // 🔧 DEBUG: Check for stale fields in database vs frontend
    console.log('🔍 ===== BACKEND FIELD COMPARISON =====');
    console.log('📋 Backend Form Fields:', form.fields.map(f => ({ 
      id: f.id, 
      question: f.question, 
      required: f.required,
      type: f.type 
    })));
    
    // Check if any submitted field IDs don't exist in backend form
    const backendFieldIds = new Set(form.fields.map(f => f.id));
    const submittedFieldIds = answers.map(a => a.fieldId);
    const unknownSubmittedFields = submittedFieldIds.filter(fieldId => !backendFieldIds.has(fieldId));
    
    if (unknownSubmittedFields.length > 0) {
      console.log('🚨 UNKNOWN SUBMITTED FIELDS DETECTED:', unknownSubmittedFields);
      console.log('⚠️ These fields were submitted but don\'t exist in backend form schema');
      console.log('📋 This suggests frontend has stale data or backend form is outdated');
    } else {
      console.log('✅ All submitted fields exist in backend form schema');
    }
    console.log('🔍 ===== END BACKEND FIELD COMPARISON =====\n');
    
    // Convert answers to formData object for evaluation
    const formData = {};
    answers.forEach(answer => {
      formData[answer.fieldId] = answer.value;
    });
    
    // 2. BACKEND VISIBILITY CHECK: Do NOT trust frontend
    console.log('🔍 ===== BACKEND SUBMISSION VALIDATION =====');
    console.log('📋 Form ID:', formId);
    console.log('📊 Submitted Answers:', answers);
    console.log('📊 Form Data for evaluation:', formData);
    
    // 🔧 CRITICAL: Re-calculate visibility using submitted answers (fresh calculation)
    const { visibleFieldIds } = evaluateFormVisibility(form.fields, formData);
    
    console.log('👁️ Backend calculated visibleFieldIds:', visibleFieldIds);
    console.log('📋 Form fields being validated:', form.fields.map(f => ({ id: f.id, question: f.question, required: f.required })));
    
    console.log('👁️ Visible Field IDs for validation:', visibleFieldIds);
    
    // 3. SECURE VALIDATION LOOP
    const validationErrors = [];
    
    console.log(`\n🔄 Starting validation loop for ${form.fields.length} fields...`);
    
    for (const field of form.fields) {
      console.log(`\n🔍 Validating field: ${field.question} (${field.id})`);
      console.log(`  Required: ${field.required}`);
      console.log(`  Visible: ${visibleFieldIds.includes(field.id)}`);
      console.log(`  All Visible Fields: [${visibleFieldIds.join(', ')}]`);
      
      // 🔧 CRITICAL FIX: Skip validation for hidden fields (CRUCIAL for branching forms)
      if (!visibleFieldIds.includes(field.id)) {
        console.log(`⏭️ SKIPPING HIDDEN FIELD: ${field.question} - Field ID: ${field.id} NOT in visibleFieldIds`);
        console.log(`  📋 This field will NOT be validated even if required: ${field.required}`);
        continue; // Ignore hidden fields completely
      }
      
      console.log(`✅ VALIDATING VISIBLE FIELD: ${field.question} - Field ID: ${field.id} FOUND in visibleFieldIds`);
      
      // 🔧 ADDITIONAL: Check if this field was actually submitted
      const submittedAnswer = answers.find(a => a.fieldId === field.id);
      if (!submittedAnswer) {
        console.log(`⚠️ Field ${field.question} was NOT submitted in payload`);
        console.log(`  📋 This suggests frontend filtering issue`);
        // Skip validation for fields not submitted (they're not required if not submitted)
        continue;
      }
      
      // Check if field is required and visible
      if (field.required) {
        // submittedAnswer already declared above, reuse it
        
        if (!submittedAnswer) {
          validationErrors.push({
            fieldId: field.id,
            message: `${field.question || field.id} is required`
          });
          continue;
        }
        
        // Check if submitted value is empty
        const isEmpty = submittedAnswer.value === null || 
                       submittedAnswer.value === undefined || 
                       submittedAnswer.value === '' ||
                       (Array.isArray(submittedAnswer.value) && submittedAnswer.value.length === 0);
        
        if (isEmpty) {
          validationErrors.push({
            fieldId: field.id,
            message: `${field.question || field.id} is required`
          });
        }
      }
      
      // 4. REPEATABLE GROUP MIN VALIDATION
      if (field.type === 'repeatable_group' && field.required) {
        const submittedAnswer = answers.find(a => a.fieldId === field.id);
        
        if (submittedAnswer && Array.isArray(submittedAnswer.value)) {
          const minItems = field.minItems || 1;
          if (submittedAnswer.value.length < minItems) {
            validationErrors.push({
              fieldId: field.id,
              message: `At least ${minItems} ${minItems === 1 ? 'entry' : 'entries'} required for ${field.question || field.id}`
            });
          }
        }
      }
      
      // Additional field-specific validation
      // submittedAnswer already declared above, reuse it
      if (submittedAnswer) {
        const validation = validateField(field, submittedAnswer.value);
        if (!validation.valid) {
          validationErrors.push({
            fieldId: field.id,
            message: validation.message
          });
        }
      }
    }
    
    // 🔧 FINAL VALIDATION SUMMARY
    console.log('\n📊 ===== VALIDATION SUMMARY =====');
    console.log(`📋 Total Fields Processed: ${form.fields.length}`);
    console.log(`👁️ Visible Fields Count: ${visibleFieldIds.length}`);
    console.log(`⏭️ Hidden Fields Skipped: ${form.fields.length - visibleFieldIds.length}`);
    console.log(`❌ Validation Errors: ${validationErrors.length}`);
    
    if (validationErrors.length > 0) {
      console.log('🚨 VALIDATION ERRORS FOUND:');
      validationErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. Field: ${error.fieldId}, Error: ${error.message}`);
      });
    } else {
      console.log('✅ NO VALIDATION ERRORS - Form is valid!');
    }
    console.log('🔍 ===== END VALIDATION SUMMARY =====\n');
    
    // Check if there are validation errors, return them
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors occurred',
        errors: validationErrors
      });
    }
    
    // 5. SAVE: Create new FormResponse document
    const newFormResponse = new FormResponse({
      formId: form._id,
      answers: answers.map(answer => ({
        fieldId: answer.fieldId,
        value: answer.value
      })),
      respondentEmail: respondentEmail || null,
      submittedAt: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    });
    
    await newFormResponse.save();
    
    res.status(201).json({
      success: true,
      message: 'Form submitted successfully',
      data: {
        responseId: newFormResponse._id,
        submittedAt: newFormResponse.submittedAt,
        visibleFieldCount: visibleFieldIds.length
      }
    });
    
  } catch (error) {
    console.error('Error submitting form response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit form response',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get form responses (FIXED: Use FormResponse model)
const getFormResponses = async (req, res) => {
  try {
    // First verify form exists
    const form = await Form.findById(req.params.id);
    
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }
    
    // Fetch responses from FormResponse model
    const responses = await FormResponse.find({ formId: req.params.id })
      .sort({ submittedAt: -1 })
      .lean(); // Use lean for better performance
    
    // Format responses for frontend
    const formattedResponses = responses.map((response, index) => {
      // Create answers array matching form field order
      const responseAnswers = form.fields.map(field => {
        const fieldResponse = response.answers.find(a => a.fieldId === field.id);
        return fieldResponse ? fieldResponse.value : null;
      });
      
      return {
        id: response._id,
        submitted: new Date(response.submittedAt).toLocaleString(),
        respondentName: responseAnswers[0] || 'Anonymous',
        respondentEmail: response.respondentEmail || responseAnswers[1] || 'No email',
        answers: responseAnswers,
        status: 'completed',
        ipAddress: response.ipAddress,
        userAgent: response.userAgent
      };
    });
    
    res.json({
      success: true,
      data: formattedResponses
    });
    
  } catch (error) {
    console.error('Error fetching form responses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch form responses',
      error: error.message
    });
  }
};

// Evaluate visibility dynamically for frontend
const evaluateVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;
    
    // Validate required fields
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Answers object is required'
      });
    }
    
    // Check if form exists
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }
    
    // Convert answers object to formData format for evaluation
    const formData = {};
    if (Array.isArray(answers)) {
      // If answers is an array of objects (like from frontend submission)
      answers.forEach(answer => {
        formData[answer.fieldId] = answer.value;
      });
    } else {
      // If answers is already an object (like from form field changes)
      Object.assign(formData, answers);
    }
    
    // Use formEvaluator to calculate visibility
    const { visibleFieldIds, endFormTriggered, endFormMessage } = evaluateFormVisibility(form.fields, formData);
    
    res.json({
      success: true,
      data: {
        visibleFieldIds,
        endFormTriggered,
        endFormMessage
      }
    });
    
  } catch (error) {
    console.error('Error evaluating visibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to evaluate visibility',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update form
const updateForm = async (req, res) => {
  try {
    const { title, description, fields } = req.body;
    
    // First check if form exists and belongs to user
    const existingForm = await Form.findById(req.params.id);
    if (!existingForm) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }
    
    // Check if user owns this form
    if (!req.user || !req.user.id || existingForm.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this form'
      });
    }
    
    // Validate fields if provided
    if (fields && Array.isArray(fields)) {
      for (const field of fields) {
        if (!field.type || !field.question) {
          return res.status(400).json({ message: 'Each field must have a type and question' });
        }
        
        // Update order if not provided
        if (!field.order) {
          field.order = fields.indexOf(field);
        }
      }
    }
    
    const updateData = {
      ...req.body,
      updatedAt: Date.now()
    };
    
    const form = await Form.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'username email');
    
    res.json({
      success: true,
      message: 'Form updated successfully',
      data: form
    });
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update form',
      error: error.message
    });
  }
};

// Delete form
const deleteForm = async (req, res) => {
  try {
    // First check if form exists and belongs to user
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }
    
    // Check if user owns this form
    if (!req.user || !req.user.id || form.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this form'
      });
    }
    
    // Delete the form
    await Form.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Form deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete form',
      error: error.message
    });
  }
};

module.exports = {
  createForm,
  getForms,
  getFormById,
  submitResponse,
  getFormResponses,
  evaluateVisibility,
  updateForm,
  deleteForm
};
