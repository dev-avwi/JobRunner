import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PARSE_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, string>[];
}

function resolveWorkerPath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, '../scripts/spreadsheet-parser-worker.mjs'),
    path.resolve(moduleDir, '../../scripts/spreadsheet-parser-worker.mjs'),
    path.resolve(process.cwd(), 'scripts/spreadsheet-parser-worker.mjs'),
    path.resolve(process.cwd(), 'artifacts/api-server/scripts/spreadsheet-parser-worker.mjs'),
  ];
  const workerPath = candidates.find((candidate) => existsSync(candidate));
  if (!workerPath) {
    throw new Error('Secure spreadsheet parser is unavailable');
  }
  return workerPath;
}

function parseInIsolatedProcess<T>(
  payload: Record<string, unknown>,
): Promise<T> {
  const workerPath = resolveWorkerPath();

  return new Promise<T>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--max-old-space-size=192', workerPath],
      {
        cwd: path.dirname(path.dirname(workerPath)),
        env: {
          NODE_ENV: 'production',
          PATH: process.env.PATH || '',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let settled = false;

    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(value as T);
    };

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('Spreadsheet parsing timed out'));
    }, PARSE_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        finish(new Error('Spreadsheet output is too large'));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (Buffer.concat(stderr).length < 4096) stderr.push(chunk);
    });
    child.on('error', () => {
      finish(new Error('Spreadsheet parsing could not start'));
    });
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString('utf8').trim();
        finish(new Error(detail || 'Spreadsheet parsing failed'));
        return;
      }
      try {
        finish(undefined, JSON.parse(Buffer.concat(stdout).toString('utf8')) as T);
      } catch {
        finish(new Error('Spreadsheet parser returned an invalid response'));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

export function parseSmartImportSpreadsheet(
  buffer: Buffer,
  fileName: string,
  maxRows: number,
): Promise<ParsedSpreadsheet> {
  return parseInIsolatedProcess<ParsedSpreadsheet>({
    mode: 'smart-import',
    fileName,
    maxRows,
    data: buffer.toString('base64'),
  });
}

export function parseFormSpreadsheet(buffer: Buffer): Promise<string[]> {
  return parseInIsolatedProcess<string[]>({
    mode: 'form-import',
    data: buffer.toString('base64'),
  });
}