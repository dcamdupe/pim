import type { Config } from '../config';

// A source that logs in to a bank/institution and downloads a transactions export file for the
// given date range (dd/MM/yyyy), returning the saved file's path.
export interface Downloader {
  download(config: Config, startDate: string, endDate: string): Promise<string>;
}
