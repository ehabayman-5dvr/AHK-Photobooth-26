const path = require('node:path');

function settingsDirectory({ packaged, portableDirectory, executablePath, projectDirectory, testDirectory }) {
  if (!packaged) return path.resolve(testDirectory || projectDirectory);
  // The portable launcher extracts Electron into TEMP; use the launcher's folder.
  return portableDirectory ? path.resolve(portableDirectory) : path.dirname(executablePath);
}

module.exports = { settingsDirectory };
