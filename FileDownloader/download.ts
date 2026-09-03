import fs from 'fs';
import { loadConfig } from './config';
import type { Downloader } from './downloaders/downloader';
import { TmbankDownloader } from './downloaders/tmbank';
import { WestpacDownloader } from './downloaders/westpac';
import { PimClient } from './pim';

async function main() {
  const config = loadConfig();

  // Each downloader's export is filed under that bank's own account name (config.<bank>Account),
  // reused as the PIM account name.
  const jobs: { downloader: Downloader; pimAccount: string }[] = [
    { downloader: new WestpacDownloader(), pimAccount: config.westpacAccount },
    { downloader: new TmbankDownloader(), pimAccount: config.tmbankAccount },
  ];

  const startDate = process.env.StartDate;
  const endDate = process.env.EndDate;
  if (!startDate || !endDate) {
    throw new Error('Missing required StartDate/EndDate environment variables.');
  }

  console.log(`Downloading transactions from ${startDate} to ${endDate}`);

  const pim = new PimClient(config);

  for (const { downloader, pimAccount } of jobs) {
    console.log(`Running ${downloader.constructor.name}`);
    const savedPath = await downloader.download(config, startDate, endDate);
    const { size } = fs.statSync(savedPath);
    console.log(`Saved: ${savedPath} (${size} bytes)`);

    await pim.uploadFile(savedPath, pimAccount);
    console.log(`Uploaded to PIM account: ${pimAccount}`);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
