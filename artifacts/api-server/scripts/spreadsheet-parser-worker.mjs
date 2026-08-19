import * as XLSX from 'xlsx';

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_FORM_TEXT_BYTES = 8 * 1024 * 1024;
const chunks = [];
let inputBytes = 0;

process.stdin.on('data', (chunk) => {
  inputBytes += chunk.length;
  if (inputBytes > MAX_INPUT_BYTES * 2) {
    process.stderr.write('Spreadsheet input is too large');
    process.exit(1);
  }
  chunks.push(chunk);
});

process.stdin.on('end', () => {
  try {
    const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const buffer = Buffer.from(request.data || '', 'base64');
    if (!buffer.length || buffer.length > MAX_INPUT_BYTES) {
      throw new Error('Spreadsheet input is empty or too large');
    }

    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      raw: false,
      cellDates: false,
    });

    if (request.mode === 'smart-import') {
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('The file has no sheets');
      const sheet = workbook.Sheets[sheetName];
      const grid = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });
      while (grid.length && grid[0].every((cell) => String(cell ?? '').trim() === '')) {
        grid.shift();
      }
      if (grid.length < 2) {
        throw new Error('The file needs a header row and at least one data row');
      }

      const headerRow = grid[0].map((header, index) => {
        const value = String(header ?? '').trim();
        return value || `Column ${index + 1}`;
      });
      const seen = new Map();
      const headers = headerRow.map((header) => {
        const count = seen.get(header) || 0;
        seen.set(header, count + 1);
        return count === 0 ? header : `${header} (${count + 1})`;
      });
      const rows = [];
      const maxRows = Number(request.maxRows) || 5000;
      for (let index = 1; index < grid.length; index++) {
        const raw = grid[index];
        if (!raw || raw.every((cell) => String(cell ?? '').trim() === '')) continue;
        if (rows.length >= maxRows) {
          throw new Error(`Maximum ${maxRows} rows per import. "${request.fileName || 'Spreadsheet'}" has more data rows.`);
        }
        const row = {};
        headers.forEach((header, column) => {
          row[header] = String(raw[column] ?? '').trim();
        });
        rows.push(row);
      }
      process.stdout.write(JSON.stringify({ headers, rows }));
      return;
    }

    if (request.mode === 'form-import') {
      const textParts = [];
      let textBytes = 0;
      for (const sheetName of workbook.SheetNames.slice(0, 10)) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], {
          blankrows: false,
        });
        if (!csv.trim()) continue;
        const part = `Sheet: ${sheetName}\n${csv}`;
        textBytes += Buffer.byteLength(part);
        if (textBytes > MAX_FORM_TEXT_BYTES) {
          throw new Error('Spreadsheet content is too large');
        }
        textParts.push(part);
      }
      process.stdout.write(JSON.stringify(textParts));
      return;
    }

    throw new Error('Unsupported spreadsheet parsing mode');
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message : 'Spreadsheet parsing failed');
    process.exit(1);
  }
});