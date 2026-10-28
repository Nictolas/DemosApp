'use strict';
const { MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE: MIN } = require('./politicalAggregatePrivacy');

const SEX_VALUES = new Set(['M', 'F']);

function validatedSexRows(rows) {
  if (!Array.isArray(rows)) return null;
  const seen = new Set();
  const safe = [];
  for (const row of rows) {
    if (!row || !SEX_VALUES.has(row.sesso) || seen.has(row.sesso)) return null;
    seen.add(row.sesso);
    safe.push(row);
  }
  return safe;
}

// Non pubblicare alcuna cella se e' presente almeno un gruppo 1..9;
// l'intera tabella e' nascosta, non solo la riga piccola.
function protectSexCountRows(rows, minimumCellSize = MIN) {
  const valid = validatedSexRows(rows);
  if (!valid) return { suppressed: true, data: [] };
  const counts = valid.map(row => ({ sesso: row.sesso, totale: Number(row.totale) }));
  const unsafe = counts.some(row =>
    !Number.isSafeInteger(row.totale) || row.totale < 0 ||
    (row.totale > 0 && row.totale < minimumCellSize)
  );
  return unsafe
    ? { suppressed: true, data: [] }
    : { suppressed: false, data: counts };
}

// L'incrocio sesso × opinione e' sensibile: anche un sottoconteggio f/c/i
// positivo sotto soglia potrebbe rivelare una scelta politica individuale.
function protectSexOpinionRows(rows, minimumCellSize = MIN) {
  const valid = validatedSexRows(rows);
  if (!valid) return { suppressed: true, data: [] };
  const converted = valid.map(row => ({
    sesso: row.sesso,
    favorevole: Number(row.favorevole),
    contrario: Number(row.contrario),
    indeciso: Number(row.indeciso)
  }));
  const unsafe = converted.some(row => {
    const cells = [row.favorevole, row.contrario, row.indeciso];
    return cells.some(value => !Number.isSafeInteger(value) || value < 0 ||
        (value > 0 && value < minimumCellSize)) ||
      cells.reduce((a, b) => a + b, 0) < minimumCellSize;
  });
  return unsafe
    ? { suppressed: true, data: [] }
    : { suppressed: false, data: converted };
}

module.exports = { protectSexCountRows, protectSexOpinionRows };
