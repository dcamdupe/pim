import type { Config } from '../config';

// A source that logs in to a bank/institution and downloads a transactions export file,
// returning the saved file's path.
export interface Downloader {
  download(config: Config): Promise<string>;
}
