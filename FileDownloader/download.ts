import { chromium, devices } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });

interface Config {
  westpacCustomerId: string;
  westpacPassword: string;
  westpacAccount: string;
  pimBaseUrl: string;
  pimLogin: string;
  pimPassword: string;
  pimAccount: string;
  startDate: string;
  endDate: string;
}

// Loads every environment variable this script needs into a single typed object, failing fast
// (naming every missing one) rather than letting a blank value silently reach Westpac/the Api.
export function loadConfig(): Config {
  const values = {
    westpacCustomerId: process.env.WestpacCustomerId,
    westpacPassword: process.env.WestpacPassword,
    westpacAccount: process.env.WestpacAccount,
    pimBaseUrl: process.env.BaseUrl,
    pimLogin: process.env.PimLogin,
    pimPassword: process.env.PimPassword,
    pimAccount: process.env.PimAccount,
    startDate: process.env.StartDate,
    endDate: process.env.EndDate,
  };

  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  return values as Config;
}

export async function downloadWestpacTransactions(config: Config): Promise<string> {
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
    await page.getByRole('link', { name: config.westpacAccount }).click();
    await page.goto('https://banking.westpac.com.au/secure/banking/reportsandexports/home');
    await page.getByRole('link', { name: 'Export Transactions' }).click();
    await page.locator('input[name="DateRange.StartDate"]').fill(config.startDate);
    await page.locator('input[name="DateRange.EndDate"]').fill(config.endDate);
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

interface PimLoginResponse {
  token: string;
}

async function loginToPim(config: Config): Promise<string> {
  const response = await fetch(`${config.pimBaseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: config.pimLogin, password: config.pimPassword }),
  });
  if (!response.ok) {
    throw new Error(`PIM login failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as PimLoginResponse;
  return data.token;
}

// Logs in to the PIM Api and uploads `filePath` to POST /transactions/file under
// config.pimAccount - mirrors FrontEnd/src/services/transactionsService.ts's
// uploadTransactions(), just from a Node script rather than the browser.
export async function uploadTransactionsFile(config: Config, filePath: string): Promise<void> {
  const token = await loginToPim(config);

  const form = new FormData();
  form.append('account', config.pimAccount);
  form.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));

  const response = await fetch(`${config.pimBaseUrl}/transactions/file`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`PIM file upload failed: ${response.status} ${response.statusText}`);
  }
}

async function main() {
  const config = loadConfig();

  const savedPath = await downloadWestpacTransactions(config);
  console.log(`Saved: ${savedPath}`);

  await uploadTransactionsFile(config, savedPath);
  console.log(`Uploaded to PIM account: ${config.pimAccount}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
