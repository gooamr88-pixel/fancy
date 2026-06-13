const fs = require('fs');

const filePath = 'c:/Users/yousef amr/Desktop/fancy/fancy/frontend/src/app/dashboard/page.js';

try {
  const buffer = fs.readFileSync(filePath);
  
  // Try to decode as UTF-8
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    const text = decoder.decode(buffer);
    console.log('File is valid UTF-8!');
  } catch (err) {
    console.error('UTF-8 decoding failed:', err.message);
    
    // Fallback: decode with replacement characters
    const cleanText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    
    // Write the cleaned text back to the file as standard UTF-8
    fs.writeFileSync(filePath, cleanText, 'utf8');
    console.log('Cleaned file written successfully!');
  }
} catch (err) {
  console.error('Error reading/writing file:', err);
}
