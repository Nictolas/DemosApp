const path = require('path');

const BACKUP_FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

const resolveBackupFilePath = ({ backupDir, fileName }) => {
  if (typeof backupDir !== 'string' || backupDir.length === 0) return null;
  if (typeof fileName !== 'string' || fileName.length === 0) return null;

  const normalizedFileName = path.basename(fileName);
  if (
    normalizedFileName !== fileName ||
    !BACKUP_FILE_NAME_PATTERN.test(normalizedFileName)
  ) {
    return null;
  }

  const backupRoot = path.resolve(backupDir);
  const backupPath = path.join(backupRoot, normalizedFileName);
  const relativePath = path.relative(backupRoot, backupPath);

  if (
    relativePath === '' ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return backupPath;
};

module.exports = {
  BACKUP_FILE_NAME_PATTERN,
  resolveBackupFilePath
};
