const MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE = 10;

function countAggregateResponses(row = {}) {
  return ['favorevole', 'contrario', 'indeciso']
    .reduce((sum, key) => sum + (Number.parseInt(row[key], 10) || 0), 0);
}

function cellThresholdMet(row, minimumCellSize = MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE) {
  return countAggregateResponses(row) >= minimumCellSize;
}

function suppressSmallCells(rows = [], minimumCellSize = MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE) {
  return rows.filter((row) => cellThresholdMet(row, minimumCellSize));
}

module.exports = {
  MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE,
  countAggregateResponses,
  cellThresholdMet,
  suppressSmallCells
};
