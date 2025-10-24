const XLSX = require('xlsx');
const path = require('path');

const templatePath = path.join(__dirname, 'public', 'templates', 'doctor-combination-template.xlsx');

try {
  const workbook = XLSX.readFile(templatePath);

  console.log('=== Template Analysis ===\n');
  console.log('Sheet Names:', workbook.SheetNames);
  console.log();

  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n=== Sheet: ${sheetName} ===`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Show headers
    if (data.length > 0) {
      console.log('Headers:', data[0]);
      console.log('Sample rows (first 5):');
      data.slice(1, 6).forEach((row, idx) => {
        console.log(`Row ${idx + 1}:`, row);
      });
      console.log(`Total rows: ${data.length - 1}`);
    }
  });

  console.log('\n=== Analysis Complete ===');
} catch (error) {
  console.error('Error reading template:', error.message);
}
