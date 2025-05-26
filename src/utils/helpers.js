const moment = require('moment');

// Configure moment for German locale
moment.locale('de');

function processMarkdown(text) {
  if (!text) return text;
  
  // Handle arrays
  if (Array.isArray(text)) {
    if (text.default) {
      text = text.default;
    } else {
      text = text.filter(t => t !== 'n.a.' && t !== 'null' && t !== null && t !== undefined && t !== '').join(', ') || '—';
    }
  }
  
  // Process custom <line> tags
  text = text.replace(/<line>(.*?)<\/line>/g, '<span class="underline">$1</span>');
  
  // Process bold markdown
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Process italic markdown
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  return text;
}

function formatDate(dateString) {
  if (!dateString) return '—';
  
  try {
    return moment(dateString).format('DD.MM.YYYY');
  } catch (error) {
    console.error('Date formatting error:', error);
    return dateString;
  }
}

// Helper function to check if a value is meaningful (not null, undefined, empty string, etc.)
function hasValue(value) {
  return value !== null && value !== undefined && value !== '' && value !== 'null' && value !== 'n.a.';
}

// Helper function to check if any object in a collection has a specific property with a meaningful value
function hasAnyPropertyWithValue(collection, propertyName) {
  if (!collection || typeof collection !== 'object') return false;
  
  return Object.values(collection).some(item => {
    return item && hasValue(item[propertyName]);
  });
}

// Additional Handlebars helpers
const handlebarsHelpers = {
  // Logical operators
  and: (a, b) => a && b,
  or: (a, b) => a || b,
  not: (a) => !a,
  
  // Comparison operators
  gt: (a, b) => a > b,
  lt: (a, b) => a < b,
  gte: (a, b) => a >= b,
  lte: (a, b) => a <= b,
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  
  // Type and utility helpers
  type: (val) => Array.isArray(val) ? 'array' : typeof val,
  join: (array, separator) => array ? array.join(separator) : '',
  includes: (array, value) => array && array.includes(value),
  length: (array) => array ? array.length : 0,
  isEmpty: (value) => !value || (Array.isArray(value) && value.length === 0),
  isNotEmpty: (value) => value && (!Array.isArray(value) || value.length > 0),
  
  // Value checking helpers
  hasValue: hasValue,
  hasAnyPropertyWithValue: hasAnyPropertyWithValue,
  
  // Specific helpers for our use case
  hasPercentileRank: (resultScales) => hasAnyPropertyWithValue(resultScales, 'percentileRank'),
  hasTScore: (resultScales) => hasAnyPropertyWithValue(resultScales, 'tScore'),
  hasCutOff: (resultScales) => hasAnyPropertyWithValue(resultScales, 'cutOffArea'),
  
  // Math helpers
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => a / b,
  
  // String helpers
  lowercase: (str) => str ? str.toLowerCase() : '',
  uppercase: (str) => str ? str.toUpperCase() : '',
  capitalize: (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '',
  
  // Safe value display helper
  safeValue: (value, defaultValue = '—') => {
    if (hasValue(value)) {
      return value;
    }
    return defaultValue;
  },
  
  // Format number helper
  formatNumber: (value, decimals = 1) => {
    if (!hasValue(value)) return '—';
    const num = parseFloat(value);
    if (isNaN(num)) return '—';
    return num.toFixed(decimals);
  },
  
  // Conditional block helpers
  if_eq: function(a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  },
  unless_eq: function(a, b, options) {
    return a !== b ? options.fn(this) : options.inverse(this);
  },
  if_gt: function(a, b, options) {
    return a > b ? options.fn(this) : options.inverse(this);
  },
  if_includes: function(array, value, options) {
    return array && array.includes(value) ? options.fn(this) : options.inverse(this);
  },
  if_has_value: function(value, options) {
    return hasValue(value) ? options.fn(this) : options.inverse(this);
  },
  unless_has_value: function(value, options) {
    return !hasValue(value) ? options.fn(this) : options.inverse(this);
  },
  
  // Helper to check if any scale has a specific property
  if_any_scale_has: function(resultScales, propertyName, options) {
    return hasAnyPropertyWithValue(resultScales, propertyName) ? options.fn(this) : options.inverse(this);
  }
};

module.exports = {
  processMarkdown,
  formatDate,
  handlebarsHelpers,
  hasValue,
  hasAnyPropertyWithValue
};