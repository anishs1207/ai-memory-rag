import { app, safeStorage, webContents } from 'electron';
import fs from 'fs';
import path from 'path';

export interface SiteCredentialInput {
  domain: string;
  username: string;
  password: string;
  autoFill: boolean;
}

export interface SiteCredentialSummary {
  domain: string;
  username: string;
  autoFill: boolean;
}

interface StoredCredential extends SiteCredentialSummary {
  encryptedPassword: string;
}

function vaultPath(): string {
  return path.join(app.getPath('userData'), 'site-credentials.json');
}

function normalizeDomain(value: string): string {
  const candidate = value.trim().toLowerCase();
  if (!candidate) throw new Error('Website domain is required.');
  const hostname = new URL(candidate.includes('://') ? candidate : `https://${candidate}`).hostname;
  return hostname.replace(/^www\./, '');
}

function readVault(): StoredCredential[] {
  const target = vaultPath();
  if (!fs.existsSync(target)) return [];
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8')) as StoredCredential[];
  } catch {
    return [];
  }
}

function writeVault(credentials: StoredCredential[]): void {
  fs.writeFileSync(vaultPath(), JSON.stringify(credentials, null, 2), 'utf8');
}

export function listSiteCredentials(): SiteCredentialSummary[] {
  return readVault().map(({ domain, username, autoFill }) => ({ domain, username, autoFill }));
}

export function saveSiteCredential(input: SiteCredentialInput): SiteCredentialSummary {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure OS credential encryption is unavailable.');
  }
  const domain = normalizeDomain(input.domain);
  if (!input.username.trim() || !input.password) throw new Error('Username and password are required.');
  const credential: StoredCredential = {
    domain,
    username: input.username.trim(),
    encryptedPassword: safeStorage.encryptString(input.password).toString('base64'),
    autoFill: input.autoFill,
  };
  const remaining = readVault().filter((item) => item.domain !== domain);
  writeVault([...remaining, credential]);
  return { domain, username: credential.username, autoFill: credential.autoFill };
}

export function deleteSiteCredential(domain: string): void {
  const normalized = normalizeDomain(domain);
  writeVault(readVault().filter((item) => item.domain !== normalized));
}

export async function applySiteCredential(webContentsId: number, pageUrl: string): Promise<boolean> {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const hostname = normalizeDomain(pageUrl);
  const credential = readVault().find((item) =>
    item.autoFill && (hostname === item.domain || hostname.endsWith(`.${item.domain}`))
  );
  const guest = webContents.fromId(webContentsId);
  if (!credential || !guest || guest.isDestroyed()) return false;

  const password = safeStorage.decryptString(Buffer.from(credential.encryptedPassword, 'base64'));
  const payload = JSON.stringify({ username: credential.username, password });
  await guest.executeJavaScript(`(() => {
    const credential = ${payload};
    const visible = (element) => !!(element && element.offsetParent !== null);
    const username = [...document.querySelectorAll('input[type="email"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i]')].find(visible);
    const password = [...document.querySelectorAll('input[type="password"], input[autocomplete="current-password"]')].find(visible);
    const setValue = (element, value) => {
      if (!element) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setValue(username, credential.username);
    setValue(password, credential.password);
    return Boolean(username || password);
  })()`);
  return true;
}
