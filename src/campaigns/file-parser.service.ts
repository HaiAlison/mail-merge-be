import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const csv = require('csv-parser');
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as stream from 'stream';
import { IParsedRow, IPreviewResult } from './campaign.type';

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  // ─────────────────────────────────────────────────────────────────────────────
  // Extract the header row and a few preview rows
  // ─────────────────────────────────────────────────────────────────────────────

  async extractPreview(
    filePath: string,
    mimeType: string,
    previewCount = 3,
  ): Promise<IPreviewResult> {
    if (this.isCsv(mimeType)) {
      return this.extractCsvPreview(filePath, previewCount);
    }
    if (this.isXlsx(mimeType)) {
      return this.extractXlsxPreview(filePath);
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  private extractCsvPreview(
    filePath: string,
    previewCount: number,
  ): Promise<IPreviewResult> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const parser = csv();
      let headers: string[] = [];
      const rows: IParsedRow[] = [];

      parser.once('headers', (h: string[]) => {
        headers = h;
      });

      parser.on('data', (row: IParsedRow) => {
        rows.push(row);
        if (rows.length >= previewCount) {
          stream.destroy(); // Stop reading after we got enough rows
          resolve({ headers, rows, previewRow: rows[0] || {}, totalRows: rows.length });
        }
      });

      parser.on('end', () => {
        resolve({ headers, rows, previewRow: rows[0] || {}, totalRows: rows.length });
      });

      parser.on('error', reject);
      stream.on('error', reject);
      stream.pipe(parser);
    });
  }

  private async extractXlsxPreview(
    filePath: string,
  ): Promise<IPreviewResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { headers: [], rows: [], previewRow: {}, totalRows: 0 };

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim();
    });
    // Filter out holes if any
    const cleanHeaders = headers.filter(Boolean);
    const headerMapping = headers; // map col index to header string

    const rows: IParsedRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const rowData: IParsedRow = {};
      row.eachCell((cell, colNumber) => {
        const header = headerMapping[colNumber - 1];
        if (header) {
          let val = String(cell.value ?? '').trim();
          if (typeof cell.value == 'object' && 'text' in cell.value) {
            val = String(cell.value.text ?? '').trim();
          }
          rowData[header] = val;
        }
      });
      rows.push(rowData);
    });

    return { headers: cleanHeaders, rows, previewRow: rows[0] || {}, totalRows: rows.length };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Stream all rows, calling onRow for each parsed row
  // ─────────────────────────────────────────────────────────────────────────────

  async streamRows(
    stream: stream.Readable,
    mimeType: string,
    onRow: (row: IParsedRow) => Promise<void>,
    onProgress?: (processed: number) => void,
  ): Promise<number> {
    if (this.isCsv(mimeType)) {
      return this.streamCsvRows(stream, onRow, onProgress);
    }
    if (this.isXlsx(mimeType)) {
      return this.streamXlsxRows(stream, onRow, onProgress);
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  private streamCsvRows(
    stream: stream.Readable,
    onRow: (row: IParsedRow) => Promise<void>,
    onProgress?: (processed: number) => void,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;

      stream
        .pipe(csv())
        .on('data', async (row: IParsedRow) => {
          stream.pause();
          try {
            await onRow(row);
            count++;
            onProgress?.(count);
          } catch (err) {
            reject(err);
          } finally {
            stream.resume();
          }
        })
        .on('end', () => resolve(count))
        .on('error', reject);

      stream.on('error', reject);
    });
  }

  private async streamXlsxRows(
    stream: stream.Readable,
    onRow: (row: IParsedRow) => Promise<void>,
    onProgress?: (processed: number) => void,
  ): Promise<number> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.read(stream as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) return 0;

    // Extract headers from row 1
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => headers.push(String(cell.value ?? '').trim()));

    let count = 0;
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (!row.hasValues) continue;

      const parsed: IParsedRow = {};
      row.eachCell((cell, colNum) => {
        const header = headers[colNum - 1];
        if (header) {
          let val = String(cell.value ?? '').trim();
          if (typeof cell.value == 'object' && 'text' in cell.value) {
            val = String(cell.value.text ?? '').trim();
          }
          parsed[header] = val;
        }
      });

      await onRow(parsed);
      count++;
      onProgress?.(count);
    }
    return count;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private isCsv(mimeType: string): boolean {
    return mimeType === 'text/csv' || mimeType === 'application/csv';
  }

  private isXlsx(mimeType: string): boolean {
    return (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    );
  }
}
