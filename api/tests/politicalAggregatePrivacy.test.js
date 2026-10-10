const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE,
  countAggregateResponses,
  cellThresholdMet,
  suppressSmallCells
} = require('../utils/politicalAggregatePrivacy');

test('political aggregates require at least ten responses per returned cell', () => {
  assert.equal(MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE, 10);
  assert.equal(cellThresholdMet({ favorevole: 4, contrario: 3, indeciso: 2 }), false);
  assert.equal(cellThresholdMet({ favorevole: 4, contrario: 3, indeciso: 3 }), true);
});

test('small demographic cells are removed before the response is returned', () => {
  const rows = [
    { fascia_eta: '18-25', favorevole: '3', contrario: '2', indeciso: '1' },
    { fascia_eta: '26-35', favorevole: '5', contrario: '3', indeciso: '2' }
  ];
  assert.equal(countAggregateResponses(rows[0]), 6);
  assert.deepEqual(suppressSmallCells(rows), [rows[1]]);
});
