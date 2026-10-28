'use strict';

// RFC 4180 CSV output. Spreadsheet formula injection must not turn
// arbitrary user-entered strings into executable spreadsheet formulas.
function csvCellValue(value) {
  if (value === null || value === undefined) return '';
  const raw = value instanceof Date ? value.toISOString()
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Excel/LibreOffice can interpret cells beginning with these prefixes
  // (sometimes after whitespace) as formulas; force them to plain text.
  return /^[\t\r\n ]*[=+\-@]/u.test(raw) ? "'" + raw : raw;
}

function convertToCSV(data) {
  const rows = [['Campo', 'Valore']];
  function flatten(value, prefix = '') {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      for (const [key, child] of Object.entries(value)) {
        // Reject prototype pollution paths in a flat CSV export.
        if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
        flatten(child, prefix ? `${prefix}.${key}` : key);
      }
      return;
    }
    rows.push([prefix, csvCellValue(value)]);
  }
  flatten(data);
  return rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

module.exports = { convertToCSV, csvCellValue };
