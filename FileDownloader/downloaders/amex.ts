import { chromium, devices } from '@playwright/test';
import path from 'path';
import type { Config } from '../config';
import type { Downloader } from './downloader';
import { log } from '../logger';

export class AmexDownloader implements Downloader {
  async download(config: Config, startDate: string, endDate: string): Promise<string> {

    // TODO: see if we can make this run in headless
    const browser = await chromium.launch({ channel: 'chrome', headless: false });
    const context = await browser.newContext({ ...devices['Desktop Chrome'] });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    try {
      // login
      await page.goto('https://www.americanexpress.com/en-au/account/login?inav=en_au_menu_login');
      await page.getByTestId('userid-input').fill(config.amexUsername);
      await page.getByTestId('password-input').fill(config.amexPassword);
      await page.getByTestId('submit-button').click();
      log('Signed in to Amex');

      // search
      const startDateIso = convertDate(startDate);
      const endDateIso = convertDate(endDate);
      await page.goto('https://global.americanexpress.com/activity/search?from=' + startDateIso + '&to=' + endDateIso);
      await page.getByRole('button', { name: 'Search' }).click();
      log('Export form filled in');

      // download
      await page.locator('[class*="action-icon-dls-icon-download-"]').click();
      await page.locator('#axp-activity-download-body-selection-options-qif').click();
      const downloadPromise = page.waitForEvent('download');
      await page.locator('[data-test-id="axp-activity-download-footer-download-confirm"]').click();
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
