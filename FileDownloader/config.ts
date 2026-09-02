import dotenv from 'dotenv';
import path from 'path';

const ENV_PATH = path.resolve(__dirname, '.env');

dotenv.config({ path: ENV_PATH, quiet: true });

export interface Config {
  westpacCustomerId: string;
  westpacPassword: string;
  westpacAccount: string;
  tmbankMemberNumber: string;
  tmbankPassword: string;
  tmbankAccount: string;
  amexUsername: string;
  amexPassword: string;
  pimBaseUrl: string;
  pimLogin: string;
  pimPassword: string;
  pimAccount: string;
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
    tmbankMemberNumber: process.env.TmbankMemberNumber,
    tmbankPassword: process.env.TmbankPassword,
    tmbankAccount: process.env.TmbankAccount,
    pimBaseUrl: process.env.BaseUrl,
    pimLogin: process.env.PimLogin,
    pimPassword: process.env.PimPassword,
    pimAccount: process.env.PimAccount,
  };

//  return assertComplete(values, '.env');
}
