'use strict';

// GDPR portability CSV: retain false/0 values and neutralize spreadsheet
// formulas in text cells (quoted CSV alone does not prevent formula execution).
function cell(raw) {
  let value = raw;
  if (value instanceof Date) value = value.toISOString();
  else if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
    value = JSON.stringify(value);
  }
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[\u0000-\u0020\uFEFF]*[=+\-@]/u.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replace(/"/g, '""') + '"';
}

function convertToCSV(data) {
  const lines = ['Campo,Valore'];
  function walk(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const field = prefix ? prefix + '.' + key : key;
      if (value !== null && typeof value === 'object' &&
          !Array.isArray(value) && !(value instanceof Date)) {
        walk(value, field);
      } else {
        lines.push(cell(field) + ',' + cell(value));
      }
    }
  }
  walk(data);
  return lines.join('\n');
}

module.exports = { convertToCSV };
