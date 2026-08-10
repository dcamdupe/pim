import fs from 'fs';
import { loadConfig } from './config';
import { WestpacDownloader } from './downloaders/westpac';
import { PimClient } from './pim';

async function main() {
  const config = loadConfig();

  const startDate = process.env.StartDate;
  const endDate = process.env.EndDate;
  if (!startDate || !endDate) {
    throw new Error('Missing required StartDate/EndDate environment variables.');
  }

  console.log(`Downloading transactions from ${startDate} to ${endDate}`);

  const downloader = new WestpacDownloader();
  const savedPath = await downloader.download(config, startDate, endDate);
  const { size } = fs.statSync(savedPath);
  console.log(`Saved: ${savedPath} (${size} bytes)`);

  const pim = new PimClient(config);
  await pim.uploadFile(savedPath);
  console.log(`Uploaded to PIM account: ${config.pimAccount}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
