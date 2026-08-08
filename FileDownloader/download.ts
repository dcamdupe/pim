import { loadConfig } from './config';
import { WestpacDownloader } from './downloaders/westpac';
import { PimClient } from './pim';

async function main() {
  const config = await loadConfig();

  const startDate = process.env.StartDate;
  const endDate = process.env.EndDate;
  if (!startDate || !endDate) {
    throw new Error('Missing required StartDate/EndDate environment variables.');
  }

  const downloader = new WestpacDownloader();
  const savedPath = await downloader.download(config, startDate, endDate);
  console.log(`Saved: ${savedPath}`);

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
