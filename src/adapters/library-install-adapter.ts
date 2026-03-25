import { spawn } from 'child_process';
import path from 'path';
import { RepoDiscoveryAdapter } from './repo-discovery-adapter';

const GIT_SSH = path.resolve(__dirname, '..', 'utils', 'bin', 'h5p-ssh');

export interface ILibraryInstallAdapter {
  fetchRegistry(): Promise<Record<string, any>>;
  cloneRepository(dir: string, url: string): Promise<string | null>;
}

export class LibraryInstallAdapter implements ILibraryInstallAdapter {
  private discoveryAdapter = new RepoDiscoveryAdapter();

  fetchRegistry(): Promise<Record<string, any>> {
    return this.discoveryAdapter.fetchRegistry();
  }

  cloneRepository(dir: string, url: string): Promise<string | null> {
    return new Promise((resolve) => {
      const env = { ...process.env, GIT_SSH };
      const proc = spawn('git', ['clone', url, dir], { env });

      let stderr = '';
      proc.stderr.on('data', data => { stderr += data.toString(); });
      proc.on('error', err => resolve(err.message));
      proc.on('close', code => {
        if (code === 0) return resolve(null);
        if (stderr.includes('already exists')) return resolve('-1');
        if (stderr.includes('Host key verification failed.')) {
          return resolve('Host key verification failed.\nTry running ssh -T with the remote host.\n');
        }
        if (stderr.includes('Permission denied')) {
          return resolve('Permission denied.\nMake sure ssh-agent is running.\n');
        }
        resolve(stderr || `git clone exited with code ${code}`);
      });
    });
  }
}
