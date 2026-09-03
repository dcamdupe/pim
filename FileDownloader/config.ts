import dotenv from 'dotenv';
import path from 'path';

const ENV_PATH = path.resolve(__dirname, '.env');

dotenv.config({ path: ENV_PATH, quiet: true });

export interface Config {
  westpacCustomerId: string;
  westpacPassword: string;
  // Bank-site selector for the account to export.
  westpacAccount: string;
  // PIM account name the export is filed under (must match a Settings-page account).
  westpacPimAccount: string;
  tmbankMemberNumber: string;
  tmbankPassword: string;
  tmbankAccount: string;
  tmbankPimAccount: string;
  amexUsername: string;
  amexPassword: string;
  pimBaseUrl: string;
  pimApiKey: string;
}

// Fails fast (naming every missing one) rather than letting a blank value silently reach
// Westpac/the Api.
function assertComplete(values: Partial<Config>, source: string): Config {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required config value(s) from ${source}: ${missing.join(', ')}`);
  }

  return values as Config;
}

// Loads every environment variable this script needs into a single typed object.
export function loadConfig(): Config {
  const values = {
    westpacCustomerId: process.env.WestpacCustomerId,
    westpacPassword: process.env.WestpacPassword,
    westpacAccount: process.env.WestpacAccount,
    westpacPimAccount: process.env.WestpacPimAccount,
    tmbankMemberNumber: process.env.TmbankMemberNumber,
    tmbankPassword: process.env.TmbankPassword,
    tmbankAccount: process.env.TmbankAccount,
    tmbankPimAccount: process.env.TmbankPimAccount,
    pimBaseUrl: process.env.BaseUrl,
    pimApiKey: process.env.PimApiKey,
  };

  return assertComplete(values, '.env');
}
