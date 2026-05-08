// Field types configuration and validation utilities

const FIELD_TYPES = {
  // Basic field types
  SHORT_ANSWER: 'short_answer',
  PARAGRAPH: 'paragraph',
  EMAIL: 'email',
  NUMBER: 'number',
  PHONE: 'phone',
  DATE: 'date',
  DROPDOWN: 'dropdown',
  CHECKBOXES: 'checkboxes',
  MULTIPLE_CHOICE: 'multiple_choice',
  FILE_UPLOAD: 'file_upload',
  RATING: 'rating',
  TEXT: 'text',
  TEXTAREA: 'textarea',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  
  // Advanced field types
  GROUP: 'group',
  REPEATABLE_GROUP: 'repeatable_group'
};

const CONDITIONAL_OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  IS_EMPTY: 'is_empty',
  IS_NOT_EMPTY: 'is_not_empty'
};

const CONDITIONAL_ACTIONS = {
  SHOW: 'show',
  HIDE: 'hide',
  JUMP_TO: 'jump_to',
  END_FORM: 'end_form'
};

// Validation functions for different field types
const validateField = (field, value) => {
  const { type, required, options } = field;
  
  // Check if field is required and empty
  if (required && (value === undefined || value === null || value === '')) {
    return { valid: false, message: 'This field is required' };
  }
  
  // Skip validation if field is not required and empty
  if (!required && (value === undefined || value === null || value === '')) {
    return { valid: true };
  }
  
  switch (type) {
    case FIELD_TYPES.EMAIL:
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { valid: false, message: 'Please enter a valid email address' };
      }
      break;
      
    case FIELD_TYPES.NUMBER:
      if (isNaN(Number(value))) {
        return { valid: false, message: 'Please enter a valid number' };
      }
      break;
      
    case FIELD_TYPES.PHONE:
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(value)) {
        return { valid: false, message: 'Please enter a valid phone number' };
      }
      break;
      
    case FIELD_TYPES.DROPDOWN:
    case FIELD_TYPES.MULTIPLE_CHOICE:
    case FIELD_TYPES.RADIO:
      if (options && !options.includes(value)) {
        return { valid: false, message: 'Please select a valid option' };
      }
      break;
      
    case FIELD_TYPES.CHECKBOXES:
      if (Array.isArray(value)) {
        const invalidOptions = value.filter(v => !options.includes(v));
        if (invalidOptions.length > 0) {
          return { valid: false, message: 'Please select valid options' };
        }
      }
      break;
      
    case FIELD_TYPES.GROUP:
      if (typeof value !== 'object' || value === null) {
        return { valid: false, message: 'Group field must be an object' };
      }
      
      // Validate each field in the group
      for (const groupField of field.groupFields || []) {
        const groupFieldResult = validateField(groupField, value[groupField.id]);
        if (!groupFieldResult.valid) {
          return groupFieldResult;
        }
      }
      break;
      
    case FIELD_TYPES.REPEATABLE_GROUP:
      if (!Array.isArray(value)) {
        return { valid: false, message: 'Repeatable group must be an array' };
      }
      
      if (value.length < field.minItems) {
        return { valid: false, message: `Minimum ${field.minItems} item(s) required` };
      }
      
      if (value.length > field.maxItems) {
        return { valid: false, message: `Maximum ${field.maxItems} item(s) allowed` };
      }
      
      // Validate each item in the repeatable group
      for (const item of value) {
        for (const groupField of field.groupFields || []) {
          const groupFieldResult = validateField(groupField, item[groupField.id]);
          if (!groupFieldResult.valid) {
            return groupFieldResult;
          }
        }
      }
      break;
  }
  
  return { valid: true };
};

// Conditional logic evaluation
const evaluateCondition = (condition, formData) => {
  const { fieldId, operator, value } = condition;
  const fieldValue = formData[fieldId];
  
  switch (operator) {
    case CONDITIONAL_OPERATORS.EQUALS:
      return fieldValue === value;
      
    case CONDITIONAL_OPERATORS.NOT_EQUALS:
      return fieldValue !== value;
      
    case CONDITIONAL_OPERATORS.CONTAINS:
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(value);
      }
      return String(fieldValue).includes(String(value));
      
    case CONDITIONAL_OPERATORS.NOT_CONTAINS:
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(value);
      }
      return !String(fieldValue).includes(String(value));
      
    case CONDITIONAL_OPERATORS.GREATER_THAN:
      return Number(fieldValue) > Number(value);
      
    case CONDITIONAL_OPERATORS.LESS_THAN:
      return Number(fieldValue) < Number(value);
      
    case CONDITIONAL_OPERATORS.IS_EMPTY:
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
      
    case CONDITIONAL_OPERATORS.IS_NOT_EMPTY:
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      
    default:
      return false;
  }
};

const evaluateConditionalLogic = (field, formData) => {
  if (!field.conditionalLogic || !field.conditionalLogic.enabled) {
    return { shouldShow: true, shouldJump: false, jumpToFieldId: null, shouldEndForm: false };
  }
  
  const { conditions, action, logicalOperator } = field.conditionalLogic;
  
  // Evaluate all conditions
  const conditionResults = conditions.map(condition => evaluateCondition(condition, formData));
  
  // Combine results based on logical operator
  let finalResult;
  if (logicalOperator === 'or') {
    finalResult = conditionResults.some(result => result);
  } else {
    finalResult = conditionResults.every(result => result);
  }
  
  // Determine action based on result and action type
  if (finalResult) {
    switch (action) {
      case CONDITIONAL_ACTIONS.SHOW:
        return { shouldShow: true, shouldJump: false, jumpToFieldId: null, shouldEndForm: false };
        
      case CONDITIONAL_ACTIONS.HIDE:
        return { shouldShow: false, shouldJump: false, jumpToFieldId: null, shouldEndForm: false };
        
      case CONDITIONAL_ACTIONS.JUMP_TO:
        return { shouldShow: true, shouldJump: true, jumpToFieldId: field.conditionalLogic.jumpToFieldId, shouldEndForm: false };
        
      case CONDITIONAL_ACTIONS.END_FORM:
        return { shouldShow: true, shouldJump: false, jumpToFieldId: null, shouldEndForm: true, endFormMessage: field.conditionalLogic.endFormMessage };
        
      default:
        return { shouldShow: true, shouldJump: false, jumpToFieldId: null, shouldEndForm: false };
    }
  }
  
  return { shouldShow: true, shouldJump: false, jumpToFieldId: null, shouldEndForm: false };
};

// Get next visible field based on conditional logic
const getNextVisibleField = (currentFieldIndex, fields, formData) => {
  for (let i = currentFieldIndex + 1; i < fields.length; i++) {
    const field = fields[i];
    const evaluation = evaluateConditionalLogic(field, formData);
    
    if (evaluation.shouldShow) {
      if (evaluation.shouldJump) {
        // Find the jump target field
        const jumpTargetIndex = fields.findIndex(f => f.id === evaluation.jumpToFieldId);
        if (jumpTargetIndex !== -1) {
          return jumpTargetIndex;
        }
      }
      return i;
    }
  }
  
  return -1; // No more visible fields
};

module.exports = {
  FIELD_TYPES,
  CONDITIONAL_OPERATORS,
  CONDITIONAL_ACTIONS,
  validateField,
  evaluateCondition,
  evaluateConditionalLogic,
  getNextVisibleField
};
