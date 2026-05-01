const getFilenameFromDisposition = (contentDisposition, fallbackName) => {
  if (typeof contentDisposition !== 'string') {
    return fallbackName;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return fallbackName;
};

export const downloadBlobResponse = (
  response,
  fallbackName,
  { openInNewTab = false } = {}
) => {
  const blob = response?.data;
  if (!(blob instanceof Blob)) {
    throw new Error('Download payload is invalid');
  }

  const objectUrl = URL.createObjectURL(blob);
  const resolvedFileName = getFilenameFromDisposition(
    response.headers?.['content-disposition'],
    fallbackName
  );

  if (openInNewTab) {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
    return resolvedFileName;
  }

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = resolvedFileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);

  return resolvedFileName;
};
