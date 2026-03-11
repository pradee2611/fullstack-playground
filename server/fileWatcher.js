const chokidar = require('chokidar');
const path = require('path');

// File watchers for each workspace
const watchers = new Map();

// Watch workspace files for changes
function watchWorkspace(workspaceId, workspacePath, onFileChange) {
  // Stop existing watcher if any
  if (watchers.has(workspaceId)) {
    watchers.get(workspaceId).close();
  }

  const watcher = chokidar.watch(workspacePath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  });

  watcher
    .on('change', (filePath) => {
      const relativePath = path.relative(workspacePath, filePath);
      onFileChange(workspaceId, relativePath);
    })
    .on('add', (filePath) => {
      const relativePath = path.relative(workspacePath, filePath);
      onFileChange(workspaceId, relativePath);
    })
    .on('unlink', (filePath) => {
      const relativePath = path.relative(workspacePath, filePath);
      onFileChange(workspaceId, relativePath);
    });

  watchers.set(workspaceId, watcher);
  return watcher;
}

// Stop watching workspace
function stopWatching(workspaceId) {
  if (watchers.has(workspaceId)) {
    watchers.get(workspaceId).close();
    watchers.delete(workspaceId);
  }
}

module.exports = {
  watchWorkspace,
  stopWatching,
};




