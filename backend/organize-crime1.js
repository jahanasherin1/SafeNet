import fs from 'fs';

// Read the file
const content = fs.readFileSync('./crime-data-coordinates.csv', 'utf-8');

const lines = content.split('\n');
let result = 'City,Crime_Type,Year,Count\n';
let currentCity = '';
let headers = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // Skip empty lines
  if (!line) continue;
  
  // Check if this is a city name (single word, no tabs)
  if (!line.includes('\t') && line.length > 0 && line.length < 30 && !line.includes('Crime Head') && !line.includes('Cases registered')) {
    currentCity = line.charAt(0).toUpperCase() + line.slice(1).toLowerCase();
    console.log('Found city:', currentCity);
    continue;
  }
  
  // Check if this is a header row
  if (line.startsWith('Crime Head')) {
    headers = line.split('\t').map(h => h.trim()).filter(h => h);
    console.log('Headers:', headers);
    continue;
  }
  
  // Skip section headers
  if (line.includes('Cases registered under SLL') || line.includes('Police Station')) {
    continue;
  }
  
  // Process data rows
  if (line.includes('\t') && currentCity && headers.length > 1) {
    const parts = line.split('\t').map(p => p.trim());
    const crimeType = parts[0];
    
    if (crimeType && crimeType !== 'Crime Head') {
      // Process each year's data
      for (let j = 1; j < headers.length && j < parts.length; j++) {
        const year = headers[j];
        const count = parts[j] || '0';
        
        // Only add if year is valid and count is numeric
        if (year && year.match(/^\d{4}$/) && count.match(/^\d+$/)) {
          result += `${currentCity},${crimeType},${year},${count}\n`;
        }
      }
    }
  }
}

// Write organized CSV
fs.writeFileSync('./crime-data-coordinates.csv', result);
console.log('✅ crime-data-coordinates.csv organized successfully!');
console.log('Total rows:', result.split('\n').length - 1);
