export const CAMPAIGN_QUEUE = 'campaign-queue';
export const PARSE_FILE_JOB = 'parse-file';

export interface ParseFileJobPayload {
  campaignId: string;
  dataSourceId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  placeholdersMap: Record<string, string>;
  userId: string;
}
