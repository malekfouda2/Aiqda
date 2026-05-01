const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const getBackendBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_UPLOADS_BASE_URL
    || import.meta.env.VITE_BACKEND_URL
    || import.meta.env.VITE_API_BASE_URL;

  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl);
  }

  if (typeof window === 'undefined') {
    return '';
  }

  const { protocol, hostname, port, origin } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isFrontendDevPort = ['5000', '5001', '5005', '5173'].includes(port);

  if (isLocalHost && isFrontendDevPort) {
    return `${protocol}//${hostname}:3001`;
  }

  return origin;
};

export const buildUploadUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;

  if (path.startsWith('/uploads/')) {
    return `${getBackendBaseUrl()}${path}`;
  }

  if (path.startsWith('/')) return path;
  return `${getBackendBaseUrl()}/uploads/${path.replace(/^\/+/, '')}`;
};
