import fs from 'fs';
import path from 'path';
import type { Config } from './config';

// Manages uploading a downloaded transactions file to the PIM Api. Authenticates with a
// provisioned API key (Settings page -> API Key) via the X-Api-Key header - the interactive
// Google/Cognito login flow isn't usable from a headless script (UBE-106).
export class PimClient {
  constructor(private readonly config: Config) {}

  async uploadFile(filePath: string, account: string): Promise<void> {
    const form = new FormData();
    form.append('account', account);
    form.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));

    const response = await fetch(`${this.config.pimBaseUrl}/transactions/file`, {
      method: 'POST',
      headers: { 'X-Api-Key': this.config.pimApiKey },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`PIM file upload failed: ${response.status} ${response.statusText}`);
    }
  }
}
