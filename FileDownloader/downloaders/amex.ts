import { firefox } from 'playwright-core';
import { launchOptions } from 'camoufox-js';
import path from 'path';
import type { Config } from '../config';
import type { Downloader } from './downloader';
import { log } from '../logger';

export class AmexDownloader implements Downloader {
  async download(config: Config, startDate: string, endDate: string): Promise<string> {

    // Camoufox to handle the browser blocking
    const browser = await firefox.launch(
      await launchOptions({ headless: false, humanize: true, geoip: true, locale: 'en-AU' }),
    );
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // login
      await page.goto('https://www.americanexpress.com/en-au/account/login?inav=en_au_menu_login');
      await page.getByTestId('userid-input').fill(config.amexUsername);
      await page.getByTestId('password-input').fill(config.amexPassword);
      await page.getByTestId('submit-button').click();

      // Login redirects into the dashboard SPA; wait for that route and for a real dashboard
      // element to render before moving on.
      await page.waitForURL('https://global.americanexpress.com/dashboard**');
      await page.locator('[data-locator-id="statement_balance_cta_title"]').waitFor();
      log('Signed in to Amex');

      // search
      const startDateIso = convertDate(startDate);
      const endDateIso = convertDate(endDate);
      await page.goto('https://global.americanexpress.com/activity/search?from=' + startDateIso + '&to=' + endDateIso);
      await page.getByRole('button', { name: 'Search', exact: true })
        .and(page.locator('button[type="button"]'))
        .click();
      log('Export form filled in');

      // download
      await page.getByRole('button', { name: 'Download' }).click();
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
