export const buildUploadUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads/')) return path;
  return `/uploads/${path.replace(/^\/+/, '')}`;
};
