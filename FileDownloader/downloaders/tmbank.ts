import { chromium, devices } from '@playwright/test';
import path from 'path';
import type { Config } from '../config';
import type { Downloader } from './downloader';

export class TmbankDownloader implements Downloader {
  async download(config: Config, startDate: string, endDate: string): Promise<string> {
    const browser = await chromium.launch();
    const context = await browser.newContext({ ...devices['Desktop Chrome'] });
    const page = await context.newPage();

    try {
      await page.goto('https://ib.tmbank.com.au/IB/SignOn/Login.aspx');
      await page.getByRole('textbox', { name: 'Member Number' }).fill(config.tmbankMemberNumber);
      await page.getByRole('textbox', { name: 'Password' }).fill(config.tmbankPassword);
      await page.getByRole('button', { name: 'Log in' }).click();
      console.log('Signed in to TMBank Internet Banking');
      await page.getByRole('button', { name: config.tmbankAccount }).click();
      await page.getByRole('button', { name: ' View All Transaction and' }).click();
      await page.getByRole('button', { name: ' Download' }).click();
      await page.locator('input[name="STARTDATE"]').pressSequentially(startDate);
      await page.locator('input[name="ENDDATE"]').pressSequentially(endDate);
      await page.locator('#ctl00_c_ddlDocType').selectOption('QIF');
      console.log('Export form filled in');
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download' }).click();
      const download = await downloadPromise;

      // Saved to the FileDownloader root (one level up from downloaders/), not this subfolder -
      // matching where download.ts/download.sh and .gitignore's *.qif rule expect it.
      const savePath = path.join(__dirname, '..', download.suggestedFilename());
      await download.saveAs(savePath);
      return savePath;
    } finally {
      await browser.close();
    }
  }
}
