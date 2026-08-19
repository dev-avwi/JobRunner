import { describe, expect, it } from 'vitest';
import {
  parseFormSpreadsheet,
  parseSmartImportSpreadsheet,
} from '../../spreadsheetIsolation';

describe('isolated spreadsheet parsing', () => {
  it('parses smart-import rows in a separate process', async () => {
    const parsed = await parseSmartImportSpreadsheet(
      Buffer.from('Name,Email\nAlex,alex@example.com\n'),
      'clients.csv',
      100,
    );

    expect(parsed).toEqual({
      headers: ['Name', 'Email'],
      rows: [{ Name: 'Alex', Email: 'alex@example.com' }],
    });
  });

  it('extracts form-import text in a separate process', async () => {
    const parts = await parseFormSpreadsheet(
      Buffer.from('Question,Type\nSite safe?,Checkbox\n'),
    );

    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain('Site safe?');
    expect(parts[0]).toContain('Checkbox');
  });

  it('enforces the row limit before returning data to the API process', async () => {
    await expect(parseSmartImportSpreadsheet(
      Buffer.from('Name\nOne\nTwo\n'),
      'too-many.csv',
      1,
    )).rejects.toThrow('Maximum 1 rows');
  });
});