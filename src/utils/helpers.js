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
      text = text.filter(t => t !== 'n.a.' && t !== 'null' && t !== null).join(', ') || '-';
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
  if (!dateString) return '-';
  
  try {
    return moment(dateString).format('DD.MM.YYYY');
  } catch (error) {
    console.error('Date formatting error:', error);
    return dateString;
  }
}

// Additional Handlebars helpers
const handlebarsHelpers = {
  gt: (a, b) => a > b,
  eq: (a, b) => a === b,
  type: (val) => Array.isArray(val) ? 'array' : typeof val,
  join: (array, separator) => array ? array.join(separator) : '',
  add: (a, b) => a + b
};

module.exports = {
  processMarkdown,
  formatDate,
  handlebarsHelpers
};