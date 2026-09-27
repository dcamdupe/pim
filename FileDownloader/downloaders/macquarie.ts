import { firefox } from 'playwright-core';
import { launchOptions } from 'camoufox-js';
import path from 'path';
import type { Config } from '../config';
import type { Downloader } from './downloader';
import { log } from '../logger';

export class MacquarieDownloader implements Downloader {
  async download(config: Config, startDate: string, endDate: string): Promise<string> {

    // Camoufox to handle the browser blocking
    const browser = await firefox.launch(
      await launchOptions({ headless: false, humanize: true, geoip: true, locale: 'en-AU' }),
    );
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // login
      await page.goto('https://online.macquarie.com.au/personal/#/');
      await page.getByLabel('Macquarie ID').fill(config.macquarieUsername);
      await page.locator('#password').fill(config.macquariePassword);
      await page.getByRole('button', { name: 'Log in' }).click();

      await page.pause();

      // go to transactions page
      await page.goto('https://online.macquarie.com.au/io/#/account-activity');

      // set a date filter
      page.getByRole('button', { name: 'Add filter' }).click();
      page.getByLabel('Last month').click();
      page.getByRole('button', { name: 'Apply' }).click();

      // download
      page.locator('mq-svg-icon[icon="mq-icon-download"]').click();
      const downloadPromise = page.waitForEvent('download');
      page.getByTestId('download-format-qif').click();
      const download = await downloadPromise;

      // save the file
      const savePath = path.join(__dirname, '..', download.suggestedFilename());
      await download.saveAs(savePath);
      return savePath;

    } finally {
      await browser.close();
    }

    function convertDate(dateStr) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
}
