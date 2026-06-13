const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const normalizedValue = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
};

export const formatCsvDate = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

export const formatCsvBoolean = (value) => (value ? 'Yes' : 'No');

export const formatCsvList = (value) => {
  if (Array.isArray(value)) {
    return value.join('; ');
  }

  return value ?? '';
};

export const formatCsvReference = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    if (value.name && value.email) {
      return `${value.name} <${value.email}>`;
    }

    return value.name || value.email || value._id || '';
  }

  return String(value);
};

export const downloadCsv = ({ filename, columns, rows }) => {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('CSV columns are required');
  }

  const headerRow = columns.map((column) => escapeCsvValue(column.label)).join(',');
  const dataRows = (rows || []).map((row) => (
    columns.map((column) => escapeCsvValue(row?.[column.key])).join(',')
  ));
  const csvContent = [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
};
