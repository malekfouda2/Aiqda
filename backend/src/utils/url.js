const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

export const normalizeExternalUrl = (
  value,
  {
    fieldLabel = 'URL',
    required = false,
    maxLength = 500,
  } = {}
) => {
  const trimmed = normalizeString(value);

  if (!trimmed) {
    if (required) {
      throw new Error(`${fieldLabel} is required`);
    }

    return '';
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldLabel} is too long`);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error(`${fieldLabel} must be a valid URL`);
  }

  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error(`${fieldLabel} must use http or https`);
  }

  return parsedUrl.toString();
};
