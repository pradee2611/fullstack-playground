const fs = require('fs');
let code = fs.readFileSync('server/database.js', 'utf8');

// The issue is that the replacement code had escaped backticks \` inside the template literal.
// We need to replace "\`" with just "`"
code = code.replace(/\\`/g, '`');

fs.writeFileSync('server/database.js', code);
console.log('Fixed escaped backticks in database.js');
