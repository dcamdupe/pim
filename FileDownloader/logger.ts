// Runs unattended (download.sh), so every line needs a timestamp to tell when it happened (UBE-111).
function timestamp(): string {
  return `[${new Date().toISOString()}]`;
}

export function log(...args: unknown[]): void {
  console.log(timestamp(), ...args);
}

export function logError(...args: unknown[]): void {
  console.error(timestamp(), ...args);
}
