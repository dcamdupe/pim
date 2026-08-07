import { chromium, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });

export async function downloadWestpacTransactions(startDate: string, endDate: string): Promise<string> {
  const customerId = process.env.WestpacCustomerId;
  const password = process.env.WestpacPassword;
  const account = process.env.WestpacAccount;

  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const page = await context.newPage();

  try {
    await page.goto('https://banking.westpac.com.au/wbc/banking/handler?TAM_OP=login&segment=personal&logout=false');
    await page.getByRole('heading', { name: 'Sign in to Westpac Online' }).click();
    await page.getByRole('textbox', { name: 'Customer ID' }).click();
    await page.getByRole('textbox', { name: 'Customer ID' }).fill(customerId!);
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(password!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('link', { name: account! }).click();
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
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    const savePath = path.join(__dirname, download.suggestedFilename());
    await download.saveAs(savePath);
    return savePath;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const startDate = process.env.StartDate;
  const endDate = process.env.EndDate;
  if (!startDate || !endDate) {
    throw new Error('Missing required StartDate/EndDate environment variables.');
  }

  downloadWestpacTransactions(startDate, endDate)
    .then((savedPath) => console.log(`Saved: ${savedPath}`))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
