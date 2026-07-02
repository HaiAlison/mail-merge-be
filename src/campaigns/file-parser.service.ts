import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const csv = require('csv-parser');
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';

export interface ParsedRow {
  [key: string]: string;
}

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  // ─────────────────────────────────────────────────────────────────────────────
  // Cloud upload stub — swap out for S3/GCS in the future
  // ─────────────────────────────────────────────────────────────────────────────

  async pushFileToCloud(localPath: string): Promise<string> {
    // TODO: Upload to S3/GCS and return public/signed URL
    // Example: return this.s3Service.upload(localPath);
    return localPath; // currently returns local path as-is
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Extract the header row and a few preview rows
  // ─────────────────────────────────────────────────────────────────────────────

  async extractPreview(filePath: string, mimeType: string, previewCount = 3): Promise<{ headers: string[], previewRows: ParsedRow[] }> {
    if (this.isCsv(mimeType)) {
      return this.extractCsvPreview(filePath, previewCount);
    }
    if (this.isXlsx(mimeType)) {
      return this.extractXlsxPreview(filePath, previewCount);
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  private extractCsvPreview(filePath: string, previewCount: number): Promise<{ headers: string[], previewRows: ParsedRow[] }> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const parser = csv();
      let headers: string[] = [];
      const previewRows: ParsedRow[] = [];

      parser.once('headers', (h: string[]) => {
        headers = h;
      });

      parser.on('data', (row: ParsedRow) => {
        previewRows.push(row);
        if (previewRows.length >= previewCount) {
          stream.destroy(); // Stop reading after we got enough rows
          resolve({ headers, previewRows });
        }
      });

      parser.on('end', () => {
        resolve({ headers, previewRows });
      });

      parser.on('error', reject);
      stream.on('error', reject);
      stream.pipe(parser);
    });
  }

  private async extractXlsxPreview(filePath: string, previewCount: number): Promise<{ headers: string[], previewRows: ParsedRow[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { headers: [], previewRows: [] };

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim();
    });
    // Filter out holes if any
    const cleanHeaders = headers.filter(Boolean);
    const headerMapping = headers; // map col index to header string

    const previewRows: ParsedRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      if (previewRows.length >= previewCount) return;

      const rowData: ParsedRow = {};
      row.eachCell((cell, colNumber) => {
        const header = headerMapping[colNumber - 1];
        if (header) {
          rowData[header] = String(cell.value ?? '').trim();
        }
      });
      previewRows.push(rowData);
    });

    return { headers: cleanHeaders, previewRows };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Stream all rows, calling onRow for each parsed row
  // ─────────────────────────────────────────────────────────────────────────────

  async streamRows(
    filePath: string,
    mimeType: string,
    onRow: (row: ParsedRow) => Promise<void>,
    onProgress?: (processed: number) => void,
  ): Promise<number> {
    if (this.isCsv(mimeType)) {
      return this.streamCsvRows(filePath, onRow, onProgress);
    }
    if (this.isXlsx(mimeType)) {
      return this.streamXlsxRows(filePath, onRow, onProgress);
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  private streamCsvRows(
    filePath: string,
    onRow: (row: ParsedRow) => Promise<void>,
    onProgress?: (processed: number) => void,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;
      const stream = fs.createReadStream(filePath);

      stream
        .pipe(csv())
        .on('data', async (row: ParsedRow) => {
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
    filePath: string,
    onRow: (row: ParsedRow) => Promise<void>,
    onProgress?: (processed: number) => void,
  ): Promise<number> {
    const workbook = new ExcelJS.Workbook();
    const stream = fs.createReadStream(filePath);
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

      const parsed: ParsedRow = {};
      row.eachCell((cell, colNum) => {
        const header = headers[colNum - 1];
        if (header) {
          let val = String(cell.value ?? '').trim();
          if (typeof cell.value == "object" && 'text' in cell.value) {
            val = String(cell.value.text ?? '').trim();
          }
          console.log(val)
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
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    );
  }
}
