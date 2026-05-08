/**
 * Core Form Evaluation Engine for Branching Logic
 * Evaluates conditional logic and determines visible field IDs
 */

// Cache for frequently used evaluations to optimize performance
const evaluationCache = new Map();

// Clear cache periodically to prevent memory leaks
setInterval(() => {
  if (evaluationCache.size > 1000) {
    evaluationCache.clear();
  }
}, 60000); // Clear every minute

/**
 * Evaluate a single condition against current answers
 * @param {Object} condition - Condition object with fieldId, operator, value
 * @param {Object} currentAnswers - Current form answers {fieldId: value}
 * @returns {boolean} - Whether the condition is met
 */
const evaluateCondition = (condition, currentAnswers) => {
  const { fieldId, operator, value } = condition;
  const fieldValue = currentAnswers[fieldId]; // undefined if missing (treated as empty)
  
  // Handle missing answers as empty/null
  const actualValue = fieldValue !== undefined ? fieldValue : null;
  const expectedValue = value;
  
  switch (operator) {
    case 'equals':
      return actualValue === expectedValue;
    
    case 'not_equals':
      return actualValue !== expectedValue;
    
    case 'contains':
      if (actualValue === null || actualValue === undefined) return false;
      return String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
    
    case 'not_contains':
      if (actualValue === null || actualValue === undefined) return true;
      return !String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
    
    case 'greater_than':
      const actualNum = Number(actualValue);
      const expectedNum = Number(expectedValue);
      if (isNaN(actualNum) || isNaN(expectedNum)) return false;
      return actualNum > expectedNum;
    
    case 'less_than':
      const actualNum2 = Number(actualValue);
      const expectedNum2 = Number(expectedValue);
      if (isNaN(actualNum2) || isNaN(expectedNum2)) return false;
      return actualNum2 < expectedNum2;
    
    case 'is_empty':
      return actualValue === null || actualValue === undefined || actualValue === '' || 
             (Array.isArray(actualValue) && actualValue.length === 0);
    
    case 'is_not_empty':
      return actualValue !== null && actualValue !== undefined && actualValue !== '' && 
             (!Array.isArray(actualValue) || actualValue.length > 0);
    
    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
};

/**
 * Evaluate all conditions for a field using logical operators
 * @param {Array} conditions - Array of condition objects
 * @param {string} logicalOperator - 'and' or 'or'
 * @param {Object} currentAnswers - Current form answers
 * @returns {boolean} - Whether conditions are met
 */
const evaluateConditions = (conditions, logicalOperator, currentAnswers) => {
  if (!conditions || conditions.length === 0) return false;
  
  if (logicalOperator === 'or') {
    // ANY condition must be true - use early return for optimization
    for (const condition of conditions) {
      if (evaluateCondition(condition, currentAnswers)) {
        return true;
      }
    }
    return false;
  }
  
  // ALL conditions must be true - use early return for optimization
  for (const condition of conditions) {
    if (!evaluateCondition(condition, currentAnswers)) {
      return false;
    }
  }
  return true;
};

/**
 * Main form visibility evaluation function
 * @param {Array} formFields - Array of field objects from Form schema
 * @param {Object} currentAnswers - Current form answers {fieldId: value}
 * @returns {Object} - { visibleFieldIds, endFormTriggered, endFormMessage }
 */
const evaluateFormVisibility = (formFields, currentAnswers = {}) => {
  console.log('🔍 ===== BACKEND VISIBILITY EVALUATION =====');
  console.log('📋 Input Fields:', formFields.map(f => ({ 
    id: f.id, 
    question: f.question, 
    hasConditionalLogic: !!f.conditionalLogic?.enabled,
    required: f.required 
  })));
  console.log('📊 Current Answers:', currentAnswers);
  
  // Create cache key for performance optimization
  const cacheKey = JSON.stringify({
    fieldHash: formFields.map(f => f.id + (f.conditionalLogic?.enabled ? '1' : '0')).join('|'),
    answers: currentAnswers
  });
  
  // Check cache first
  if (evaluationCache.has(cacheKey)) {
    console.log('⚡ Using cached result');
    return evaluationCache.get(cacheKey);
  }
  
  // 1. Initialize with all field IDs visible
  const visibleFieldIds = new Set(formFields.map(field => field.id));
  console.log('👁️ Initially visible fields:', Array.from(visibleFieldIds));
  
  // 2. Initialize end form tracking
  let endFormTriggered = false;
  let endFormMessage = null;
  
  // 3. Process each field with conditional logic
  for (const field of formFields) {
    // Skip fields without enabled conditional logic
    if (!field.conditionalLogic?.enabled) {
      continue;
    }
    
    console.log(`\n🎯 Processing field with conditional logic: ${field.question} (${field.id})`);
    const { conditions, logicalOperator = 'and', action, jumpToFieldId, targetFieldIds, endFormMessage: message } = field.conditionalLogic;
    console.log('📋 Conditional Logic:', { conditions, logicalOperator, action, jumpToFieldId, targetFieldIds });
    
    // 4a. Evaluate conditions
    const conditionsMet = evaluateConditions(conditions, logicalOperator, currentAnswers);
    console.log(`✅ Conditions met: ${conditionsMet}`);
    
    // 4b. Handle actions based on conditions result
    if (conditionsMet) {
      // Conditions are MET
      console.log(`🎬 Executing action: ${action}`);
      switch (action) {
        case 'hide':
          console.log(`🙈 Hiding field: ${jumpToFieldId}`);
          if (jumpToFieldId && visibleFieldIds.has(jumpToFieldId)) {
            visibleFieldIds.delete(jumpToFieldId);
            console.log(`✅ Field ${jumpToFieldId} hidden successfully`);
          } else {
            console.log(`⚠️ Field ${jumpToFieldId} not found or already hidden`);
          }
          break;
          
        case 'hide_multiple':
          if (targetFieldIds && Array.isArray(targetFieldIds)) {
            for (const targetId of targetFieldIds) {
              visibleFieldIds.delete(targetId);
            }
          }
          break;
          
        case 'end_form':
          endFormTriggered = true;
          endFormMessage = message || 'Form completed';
          break;
          
        // 'show' and 'show_multiple' do nothing when conditions are met (already visible)
        case 'show':
        case 'show_multiple':
        case 'jump_to':
        default:
          // No action needed for these cases when conditions are met
          break;
      }
    } else {
      // Conditions are NOT MET
      switch (action) {
        case 'show':
          if (jumpToFieldId && visibleFieldIds.has(jumpToFieldId)) {
            visibleFieldIds.delete(jumpToFieldId);
          }
          break;
          
        case 'show_multiple':
          if (targetFieldIds && Array.isArray(targetFieldIds)) {
            for (const targetId of targetFieldIds) {
              visibleFieldIds.delete(targetId);
            }
          }
          break;
          
        // 'hide' and 'hide_multiple' do nothing when conditions are not met (already hidden)
        case 'hide':
        case 'hide_multiple':
        case 'end_form':
        default:
          // No action needed for these cases when conditions are not met
          break;
      }
    }
    
    // Early exit if form ended
    if (endFormTriggered) {
      break;
    }
  }
  
  const result = {
    visibleFieldIds: Array.from(visibleFieldIds),
    endFormTriggered,
    endFormMessage
  };
  
  console.log('📊 Final visible fields:', result.visibleFieldIds);
  console.log('🏁 End form triggered:', endFormTriggered);
  console.log('🔍 ===== END BACKEND VISIBILITY EVALUATION =====\n');
  
  // Cache the result for future use
  evaluationCache.set(cacheKey, result);
  
  return result;
};

/**
 * Clear evaluation cache (useful for testing or memory management)
 */
const clearEvaluationCache = () => {
  evaluationCache.clear();
};

/**
 * Get cache statistics for monitoring
 */
const getCacheStats = () => {
  return {
    size: evaluationCache.size,
    maxSize: 1000
  };
};

module.exports = {
  evaluateFormVisibility,
  clearEvaluationCache,
  getCacheStats,
  // Export helper functions for testing
  evaluateCondition,
  evaluateConditions
};
