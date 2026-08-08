import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(__dirname, '.env');

dotenv.config({ path: ENV_PATH, quiet: true });

export interface Config {
  westpacCustomerId: string;
  westpacPassword: string;
  westpacAccount: string;
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
function loadFromEnv(): Config {
  const values = {
    westpacCustomerId: process.env.WestpacCustomerId,
    westpacPassword: process.env.WestpacPassword,
    westpacAccount: process.env.WestpacAccount,
    pimBaseUrl: process.env.BaseUrl,
    pimLogin: process.env.PimLogin,
    pimPassword: process.env.PimPassword,
    pimAccount: process.env.PimAccount,
  };

  return assertComplete(values, '.env');
}

// Loads the Config from the JSON object stored in the AWS Secrets Manager secret "pim_data".
async function loadFromAwsSecrets(): Promise<Config> {
  const client = new SecretsManagerClient({});
  const response = await client.send(new GetSecretValueCommand({ SecretId: 'pim_data' }));
  if (!response.SecretString) {
    throw new Error('Secret "pim_data" has no SecretString value.');
  }

  const values = JSON.parse(response.SecretString) as Partial<Config>;

  return assertComplete(values, 'AWS secret "pim_data"');
}

export async function loadConfig(): Promise<Config> {
  if (fs.existsSync(ENV_PATH)) {
    console.log(`Found ${ENV_PATH} - loading config from .env`);
    return loadFromEnv();
  }

  console.log(`No .env found at ${ENV_PATH} - loading config from AWS Secrets Manager ("pim_data")`);
  return loadFromAwsSecrets();
}
