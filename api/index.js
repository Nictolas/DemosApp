// Vercel serverless function entry point
const app = require('./server-commonjs.js');

// Export the Express app for Vercel
module.exports = app;
