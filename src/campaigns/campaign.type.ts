
export enum UploadType {
  ATTACHMENT = 'attachment',
  DATA_SOURCE = 'data-source',
}

export interface IParsedRow {
  [key: string]: string;
}

export interface IPreviewResult {
  id?: string;
  headers: string[];
  rows?: IParsedRow[];
  previewRow: IParsedRow;
  totalRows: number;
} 