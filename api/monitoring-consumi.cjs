const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const filePath = path.join(__dirname, 'monitoring-data.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    data = {
      bundleSize: 0,
      apiCalls: 0,
      bandwidth: 0,
      trafficHistory: []
    };
  }
  res.status(200).json(data);
}; 