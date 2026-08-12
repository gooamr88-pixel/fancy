const { normalizeHeader } = require('../config/guestImportColumns');

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
  
  // Strip UTF-8 BOM if present (common in Excel-exported CSVs)
  let content = csvContent;
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  } else if (content.startsWith('\xEF\xBB\xBF')) {
    content = content.slice(3);
  }
  
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header using RFC 4180 compliant parser
  const rawHeaders = parseCSVLine(lines[0]);

  /**
   * HEADERS ARE FOLDED — `Guest Name` is `guest_name`.
   *
   * They were used raw, which meant a CSV whose first row read
   * "Guest Name,Email,Phone" matched none of the names the importer looks up.
   * Nothing errored: every `row.guest_name` was undefined, the importer's
   * `|| 'Unnamed Guest'` fallback fired, and the organizer was shown
   * "Import Complete · 400 guests imported successfully" over four hundred
   * blank rows.
   *
   * The .xlsx branch of importGuestsCSV has always folded its headers, so the
   * same spreadsheet worked as Excel and destroyed itself as CSV — with CSV
   * being the format documented as the round-trip one. One helper now, shared
   * by both, so they cannot disagree again.
   */
  const headers = rawHeaders.map(normalizeHeader);

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse each data line with proper quote handling
    const values = parseCSVLine(line);
    while (values.length < headers.length) values.push('');

    const rowObj = {};
    headers.forEach((header, index) => {
      if (!header) return; // a trailing comma produces an empty header; it means nothing
      rowObj[header] = values[index];
    });

    results.push(rowObj);
  }

  // The raw first row rides along so the caller can name columns it did not
  // recognise. Non-enumerable: every consumer of this function iterates the
  // returned rows, and an extra array in that list would be read as a guest.
  Object.defineProperty(results, 'headers', { value: rawHeaders, enumerable: false });
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
