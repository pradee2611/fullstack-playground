const fs = require('fs');
const path = require('path');

const indexJsPath = path.join(__dirname, 'index.js');
let indexJs = fs.readFileSync(indexJsPath, 'utf8');

// List of all database methods that are used in index.js and need "await"
const methods = [
  'createUser', 'getUser', 'getUserByEmail',
  'createProject', 'getProject', 'getAllProjects', 'updateProject', 'deleteProject',
  'createFile', 'getFile', 'getFilesByProject', 'updateFile', 'deleteFile',
  'addDependency', 'getDependency', 'getDependencies', 'removeDependency',
  'createFeedback', 'getFeedback', 'getFeedbackByProject',
  'createProgressTask', 'getProgressTask', 'getProgressTasksByProject', 'updateProgressTask',
  'setAgentPreference', 'getAgentPreference', 'getAgentPreferencesByProject'
];

let matchCount = 0;
methods.forEach(method => {
  const regex = new RegExp(`(?<!await\\s+)database\\.${method}\\(`, 'g');
  indexJs = indexJs.replace(regex, (match) => {
    matchCount++;
    return `await database.${method}(`;
  });
});

fs.writeFileSync(indexJsPath, indexJs, 'utf8');
console.log(`Updated index.js, modified ${matchCount} calls.`);
