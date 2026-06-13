import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadsRoot = path.resolve(__dirname, '../../uploads');

export const resolveUploadPath = (storedPath) => {
  if (typeof storedPath !== 'string' || !storedPath.trim()) {
    throw new Error('File not found');
  }

  const normalizedRelativePath = path.normalize(
    storedPath
      .trim()
      .replace(/^\/?uploads\/?/, '')
      .replace(/^\/+/, '')
  );

  const absolutePath = path.resolve(uploadsRoot, normalizedRelativePath);
  if (absolutePath !== uploadsRoot && !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error('Invalid file reference');
  }

  return absolutePath;
};

export const ensureUploadPathExists = async (storedPath) => {
  const absolutePath = resolveUploadPath(storedPath);

  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error('File not found');
  }

  return absolutePath;
};

export const deleteUploadPathIfExists = async (storedPath) => {
  if (typeof storedPath !== 'string' || !storedPath.trim()) {
    return false;
  }

  let absolutePath;
  try {
    absolutePath = resolveUploadPath(storedPath);
  } catch {
    return false;
  }

  try {
    await fs.unlink(absolutePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};
