import https from 'https';
import { findRepos } from '../lib/process-repos.ts';

const REGISTRY_URL = 'https://h5p.org/registry.json';
const API_VERSION = 1;

export interface IRepoDiscoveryAdapter {
  findRepositories(): Promise<string[]>;
  fetchRegistry(): Promise<Record<string, any>>;
}

export class RepoDiscoveryAdapter implements IRepoDiscoveryAdapter {
  private cachedRegistry: Record<string, any> | null = null;

  findRepositories(): Promise<string[]> {
    return findRepos();
  }

  fetchRegistry(): Promise<Record<string, any>> {
    if (this.cachedRegistry) return Promise.resolve(this.cachedRegistry);

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
          this.cachedRegistry = parsed.libraries;
          resolve(parsed.libraries);
        });
      }).on('error', e => reject(new Error(`Cannot connect to server: ${e.message}`)));
    });
  }
}
