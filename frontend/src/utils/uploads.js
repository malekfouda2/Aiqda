export const buildUploadUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return path;
  return `/uploads/${path.replace(/^\/+/, '')}`;
};
