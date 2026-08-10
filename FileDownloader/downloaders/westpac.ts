import { chromium, devices } from '@playwright/test';
import path from 'path';
import type { Config } from '../config';
import type { Downloader } from './downloader';

export class WestpacDownloader implements Downloader {
  async download(config: Config, startDate: string, endDate: string): Promise<string> {
    const browser = await chromium.launch();
    const context = await browser.newContext({ ...devices['Desktop Chrome'] });
    const page = await context.newPage();

    try {
      await page.goto('https://banking.westpac.com.au/wbc/banking/handler?TAM_OP=login&segment=personal&logout=false');
      await page.getByRole('heading', { name: 'Sign in to Westpac Online' }).click();
      await page.getByRole('textbox', { name: 'Customer ID' }).click();
      await page.getByRole('textbox', { name: 'Customer ID' }).fill(config.westpacCustomerId);
      await page.getByRole('textbox', { name: 'Password' }).click();
      await page.getByRole('textbox', { name: 'Password' }).fill(config.westpacPassword);
      await page.getByRole('button', { name: 'Sign in' }).click();
      console.log('Signed in to Westpac Online');
      await page.getByRole('link', { name: config.westpacAccount }).click();
      await page.goto('https://banking.westpac.com.au/secure/banking/reportsandexports/home');
      await page.getByRole('link', { name: 'Export Transactions' }).click();
      await page.locator('input[name="DateRange.StartDate"]').fill(startDate);
      await page.locator('input[name="DateRange.EndDate"]').fill(endDate);
      await page.getByRole('textbox', { name: 'Select accounts optional' }).click();
      await page.locator('#OpenAccounts').click();
      await page.getByRole('link', { name: 'Select dropdown' }).click();
      await page.getByRole('link', { name: 'Altitude Platinum Mastercard' }).click();
      await page.locator('label').filter({ hasText: /^QIF$/ }).click();
      await page.getByRole('link', { name: 'Select dropdown' }).click();
      await page.locator('#spoke-2-template').click();
      console.log('Export form filled in');
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export' }).click();
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
