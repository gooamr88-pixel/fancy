/**
 * Parses raw CSV string data into an array of structured JSON objects.
 * Handles standard headers: guest_name, email, phone, party_size, meal_selection
 */
const parseCSV = (csvContent) => {
  if (!csvContent) return [];
  
  const lines = csvContent.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Basic split by comma (doesn't handle commas inside quotes, but fine for simple CSV exports)
    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (values.length < headers.length) continue;

    const rowObj = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index];
    });

    results.push(rowObj);
  }

  return results;
};

/**
 * Converts a list of objects into a download-ready CSV string.
 */
const generateCSV = (headers, data, fieldMapper) => {
  const headerLine = headers.join(',');
  const rowLines = data.map(item => {
    const rowValues = fieldMapper(item);
    // Escape quotes and wrap in quotes to ensure valid CSV
    return rowValues.map(v => {
      const valStr = v === null || v === undefined ? '' : String(v);
      const escaped = valStr.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  return [headerLine, ...rowLines].join('\n');
};

module.exports = {
  parseCSV,
  generateCSV
};
