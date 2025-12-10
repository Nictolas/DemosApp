// Test lettura .env
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('DATABASE_URL presente:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL inizia con:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'NON PRESENTE');
console.log('AXIOM_API_TOKEN presente:', !!process.env.AXIOM_API_TOKEN);
console.log('AXIOM_ORG_ID presente:', !!process.env.AXIOM_ORG_ID);

