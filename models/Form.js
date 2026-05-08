const mongoose = require('mongoose');

// Sub-document schema for group fields with proper validation
const groupFieldSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Group field ID is required'
    }
  },
  type: {
    type: String,
    required: true,
    enum: ['short_answer', 'paragraph', 'email', 'number', 'phone', 'date', 'dropdown', 'checkboxes', 'multiple_choice', 'file_upload', 'rating', 'text', 'textarea', 'radio', 'checkbox', 'section']
  },
  question: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 500
  },
  label: {
    type: String,
    trim: true,
    maxlength: 200
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    type: String,
    trim: true,
    maxlength: 200
  }],
  placeholder: {
    type: String,
    trim: true,
    maxlength: 300
  },
  order: {
    type: Number,
    min: 0
  }
}, { _id: false }); // Don't create _id for sub-documents

// Sub-document schema for conditional logic conditions
const conditionSchema = new mongoose.Schema({
  fieldId: {
    type: String,
    required: false,  // Made optional to allow incomplete conditions
    validate: {
      validator: function(v) {
        // Only validate if fieldId is provided (not null/undefined/empty)
        if (v === null || v === undefined || v === '') {
          return true;  // Allow empty fieldId for incomplete conditions
        }
        return v && v.length > 0;
      },
      message: 'Field ID must be a valid string when provided'
    }
  },
  operator: {
    type: String,
    required: false,  // Made optional to allow incomplete conditions
    enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: false,  // Made optional to allow incomplete conditions
    validate: {
      validator: function(v) {
        // Only require value if operator is provided and requires a value
        if (!this.operator) {
          return true;  // No operator, so no value needed
        }
        return ['is_empty', 'is_not_empty'].includes(this.operator) || (v !== undefined && v !== null);
      },
      message: 'Value is required when operator requires it'
    }
  },
  logicalOperator: {
    type: String,
    enum: ['and', 'or'],
    default: 'and'
  }
}, { _id: false });

// Enhanced conditional logic schema with scalability
const conditionalLogicSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  conditions: [conditionSchema],
  action: {
    type: String,
    enum: ['show', 'hide', 'jump_to', 'end_form', 'show_multiple', 'hide_multiple'],
    default: 'show'
  },
  // Single target for simple actions
  jumpToFieldId: {
    type: String,
    validate: {
      validator: function(v) {
        return this.action !== 'jump_to' || v;
      },
      message: 'jumpToFieldId is required when action is jump_to'
    }
  },
  // Multiple targets for scalable actions
  targetFieldIds: [{
    type: String,
    validate: {
      validator: function(v) {
        return ['show_multiple', 'hide_multiple'].includes(this.action) ? v && v.length > 0 : true;
      },
      message: 'targetFieldIds is required for show_multiple/hide_multiple actions'
    }
  }],
  endFormMessage: {
    type: String,
    maxlength: 1000,
    validate: {
      validator: function(v) {
        return this.action !== 'end_form' || v;
      },
      message: 'endFormMessage is required when action is end_form'
    }
  },
  // Prevent infinite loops
  maxDepth: {
    type: Number,
    default: 10,
    min: 1,
    max: 50
  }
}, { _id: false });

// Main field schema with proper sub-document integration
const fieldSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true, // Ensure uniqueness within form
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Field ID is required'
    }
  },
  type: {
    type: String,
    required: true,
    enum: ['short_answer', 'paragraph', 'email', 'number', 'phone', 'date', 'dropdown', 'checkboxes', 'multiple_choice', 'file_upload', 'rating', 'text', 'textarea', 'radio', 'checkbox', 'group', 'repeatable_group', 'section']
  },
  question: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 500
  },
  label: {
    type: String,
    trim: true,
    maxlength: 200
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    type: String,
    trim: true,
    maxlength: 200
  }],
  placeholder: {
    type: String,
    trim: true,
    maxlength: 300
  },
  order: {
    type: Number,
    min: 0
  },
  
  // Group specific properties - now using proper sub-document schema
  groupFields: [groupFieldSchema],
  
  // Repeatable Group specific properties
  minItems: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  maxItems: {
    type: Number,
    default: 10,
    min: 1,
    max: 100,
    validate: {
      validator: function(v) {
        return v >= this.minItems;
      },
      message: 'maxItems must be greater than or equal to minItems'
    }
  },
  addButtonText: {
    type: String,
    default: 'Add Item',
    trim: true,
    maxlength: 50
  },
  removeButtonText: {
    type: String,
    default: 'Remove',
    trim: true,
    maxlength: 50
  },
  
  // Enhanced Conditional Logic - using proper sub-document schema
  conditionalLogic: conditionalLogicSchema
}, { _id: false });

// Main form schema
const formSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  fields: [fieldSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Custom validation to prevent circular references in conditional logic
formSchema.pre('save', async function() {
  const form = this;
  const fieldIds = form.fields.map(f => f.id);
  const visited = new Set();
  
  function checkCircularReference(fieldId, depth = 0) {
    if (depth > 10) return false; // Prevent infinite recursion
    if (visited.has(fieldId)) return true; // Circular reference detected
    
    visited.add(fieldId);
    
    const field = form.fields.find(f => f.id === fieldId);
    if (!field || !field.conditionalLogic?.enabled) {
      visited.delete(fieldId);
      return false;
    }
    
    // Check jump target
    if (field.conditionalLogic.action === 'jump_to' && field.conditionalLogic.jumpToFieldId) {
      if (checkCircularReference(field.conditionalLogic.jumpToFieldId, depth + 1)) {
        return true;
      }
    }
    
    // Check multiple targets
    if (field.conditionalLogic.targetFieldIds) {
      for (const targetId of field.conditionalLogic.targetFieldIds) {
        if (checkCircularReference(targetId, depth + 1)) {
          return true;
        }
      }
    }
    
    visited.delete(fieldId);
    return false;
  }
  
  // Check all fields for circular references
  for (const field of form.fields) {
    if (field.conditionalLogic?.enabled) {
      visited.clear();
      if (checkCircularReference(field.id)) {
        const error = new Error(`Circular reference detected in field "${field.question}" (${field.id})`);
        error.name = 'ValidationError';
        throw error;
      }
    }
  }
});

// Custom validation to ensure all conditional logic references are valid
formSchema.pre('save', async function() {
  const form = this;
  const fieldIds = new Set(form.fields.map(f => f.id));
  
  for (const field of form.fields) {
    if (field.conditionalLogic?.enabled) {
      // Validate condition field references
      for (const condition of field.conditionalLogic.conditions) {
        // Skip validation for incomplete conditions (empty fieldId)
        if (!condition.fieldId || condition.fieldId.trim() === '') {
          continue;
        }
        
        if (!fieldIds.has(condition.fieldId)) {
          const error = new Error(`Invalid field reference in condition: ${condition.fieldId} does not exist`);
          error.name = 'ValidationError';
          throw error;
        }
        
        // 🔧 FIXED: Allow self-reference for choice-based fields with safeguards
        // Self-reference is allowed for choice-based fields (dropdown, radio, checkboxes)
        // but prevented for text/number fields to avoid infinite loops
        const choiceBasedTypes = ['dropdown', 'multiple_choice', 'radio', 'checkboxes'];
        const isChoiceBased = choiceBasedTypes.includes(field.type);
        
        if (condition.fieldId === field.id && !isChoiceBased) {
          const error = new Error(`Field "${field.question}" (${field.type}) cannot reference itself in conditional logic. Self-reference is only allowed for choice-based fields (dropdown, radio, checkboxes).`);
          error.name = 'ValidationError';
          throw error;
        }
      }
      
      // Validate jump target
      if (field.conditionalLogic.action === 'jump_to' && field.conditionalLogic.jumpToFieldId) {
        if (!fieldIds.has(field.conditionalLogic.jumpToFieldId)) {
          const error = new Error(`Invalid jump target: ${field.conditionalLogic.jumpToFieldId} does not exist`);
          error.name = 'ValidationError';
          throw error;
        }
      }
      
      // Validate multiple targets
      if (field.conditionalLogic.targetFieldIds) {
        for (const targetId of field.conditionalLogic.targetFieldIds) {
          if (!fieldIds.has(targetId)) {
            const error = new Error(`Invalid target field: ${targetId} does not exist`);
            error.name = 'ValidationError';
            throw error;
          }
          
          // Prevent self-reference in targets
          if (targetId === field.id) {
            const error = new Error(`Field "${field.question}" cannot target itself in conditional logic`);
            error.name = 'ValidationError';
            throw error;
          }
        }
      }
    }
  }
});

// Static method to validate form structure
formSchema.statics.validateStructure = function(formData) {
  const errors = [];
  
  // Check for duplicate field IDs
  const fieldIds = formData.fields.map(f => f.id);
  const duplicates = fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate field IDs found: ${duplicates.join(', ')}`);
  }
  
  // Check group fields for valid structure
  formData.fields.forEach(field => {
    if (field.type === 'group' || field.type === 'repeatable_group') {
      if (!field.groupFields || field.groupFields.length === 0) {
        errors.push(`Group field "${field.question}" must have at least one sub-field`);
      }
      
      // Check for duplicate IDs in group fields
      const groupFieldIds = field.groupFields.map(gf => gf.id);
      const groupDuplicates = groupFieldIds.filter((id, index) => groupFieldIds.indexOf(id) !== index);
      if (groupDuplicates.length > 0) {
        errors.push(`Duplicate group field IDs found in "${field.question}": ${groupDuplicates.join(', ')}`);
      }
    }
  });
  
  return errors;
};

module.exports = mongoose.model('Form', formSchema);
