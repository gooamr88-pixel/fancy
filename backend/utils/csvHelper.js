/**
 * Parses a single CSV line into an array of field values, handling
 * quoted fields, escaped quotes, and commas within quotes (RFC 4180).
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    
    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses raw CSV string data into an array of structured JSON objects.
 * Handles standard headers: guest_name, email, phone, party_size, meal_selection
 */
const parseCSV = (csvContent) => {
  if (!csvContent) return [];
  
  const lines = csvContent.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header using RFC 4180 compliant parser
  const headers = parseCSVLine(lines[0]);
  
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse each data line with proper quote handling
    const values = parseCSVLine(line);
    while (values.length < headers.length) values.push('');

    const rowObj = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index];
    });

    results.push(rowObj);
  }

  return results;
};

/**
 * Sanitizes a cell value to prevent CSV formula injection.
 * Prefixes values starting with formula-injection characters with a single-quote.
 */
const sanitizeCsvValue = (val) => {
  if (!val) return val;
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
};

/**
 * Converts a list of objects into a download-ready CSV string.
 */
const generateCSV = (headers, data, fieldMapper) => {
  // Quote headers the same way as data values
  const headerLine = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',');
  const rowLines = data.map(item => {
    const rowValues = fieldMapper(item);
    // Escape quotes, sanitize against CSV injection, and wrap in quotes to ensure valid CSV
    return rowValues.map(v => {
      const valStr = v === null || v === undefined ? '' : String(v);
      const sanitized = sanitizeCsvValue(valStr);
      const escaped = sanitized.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  return [headerLine, ...rowLines].join('\n');
};

module.exports = {
  parseCSV,
  generateCSV,
  sanitizeCsvValue
};
