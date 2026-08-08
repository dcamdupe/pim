import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });

export interface Config {
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
