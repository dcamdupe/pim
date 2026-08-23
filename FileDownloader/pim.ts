import fs from 'fs';
import path from 'path';
import type { Config } from './config';

interface PimLoginResponse {
  token: string;
}

// Manages authentication against the PIM Api and uploading a downloaded transactions file -
// mirrors FrontEnd/src/services/authService.ts and transactionsService.ts, from a Node script.
export class PimClient {
  private token: string | null = null;

  constructor(private readonly config: Config) {}

  async login(): Promise<void> {
    const response = await fetch(`${this.config.pimBaseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.config.pimLogin, password: this.config.pimPassword }),
    });
    if (!response.ok) {
      throw new Error(`PIM login failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as PimLoginResponse;
    this.token = data.token;
  }

  async uploadFile(filePath: string): Promise<void> {
    if (!this.token) {
      await this.login();
    }

    const form = new FormData();
    form.append('account', this.config.pimAccount);
    form.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));

    const response = await fetch(`${this.config.pimBaseUrl}/transactions/file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`PIM file upload failed: ${response.status} ${response.statusText}`);
    }
  }
}
