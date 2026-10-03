import https from 'https';
import { spawn } from 'child_process';
import { GIT_SSH, sshError } from '../repos/git.ts';

/* The h5p.org library registry, which `h5p utils list` and `h5p utils get` read.
This is a different list from the one `getRegistry` (registry.ts) manages. */

const REGISTRY_URL = 'https://h5p.org/registry.json';
const API_VERSION = 1;

export type RegistryLibrary = { repository: string; dependencies?: string[] };

let cachedRegistry: Record<string, RegistryLibrary> | null = null;

export function fetchRegistry(): Promise<Record<string, RegistryLibrary>> {
  if (cachedRegistry) return Promise.resolve(cachedRegistry);

  return new Promise((resolve, reject) => {
    https.get(REGISTRY_URL, response => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Server responded with HTTP ${response.statusCode}.`));
      }
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        let parsed: any;
        try { parsed = JSON.parse(body); }
        catch (e: any) { return reject(new Error(`Cannot parse registry: ${e.message}`)); }
        if (parsed.apiVersion !== API_VERSION) {
          return reject(new Error('API Version mismatch.\nMake sure this tool is up to date.'));
        }
        cachedRegistry = parsed.libraries;
        resolve(parsed.libraries);
      });
    }).on('error', e => reject(new Error(`Cannot connect to server: ${e.message}`)));
  });
}

/** The named libraries plus everything they depend on, by registry name. */
export async function resolveCollection(libraries: string[]): Promise<Map<string, RegistryLibrary>> {
  const registry = await fetchRegistry();
  const collection = new Map<string, RegistryLibrary>();

  const add = async (name: string): Promise<void> => {
    if (collection.has(name)) return;
    const library = registry[name];
    if (!library) throw new Error(`No such library: ${name}`);
    collection.set(name, library);
    await Promise.all((library.dependencies ?? []).map(add));
  };

  await Promise.all(libraries.filter(l => l !== '').map(add));
  return collection;
}

export function cloneLibrary(
  name: string,
  url: string,
  fetchWithHttps: boolean,
): Promise<{ status: 'ok' | 'skipped' | 'failed'; error?: string }> {
  const resolvedUrl = fetchWithHttps ? url.replace('git@github.com:', 'https://github.com/') : url;

  return new Promise((resolve) => {
    const proc = spawn('git', ['clone', resolvedUrl, name], { env: { ...process.env, GIT_SSH } });

    let stderr = '';
    proc.stderr.on('data', data => { stderr += data.toString(); });
    proc.on('error', err => resolve({ status: 'failed', error: err.message }));
    proc.on('close', code => {
      if (code === 0) return resolve({ status: 'ok' });
      if (stderr.includes('already exists')) return resolve({ status: 'skipped' });
      resolve({ status: 'failed', error: sshError(stderr) || `git clone exited with code ${code}` });
    });
  });
}
