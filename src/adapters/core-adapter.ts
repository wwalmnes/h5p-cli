import * as fs from 'fs';
import logic from '../../logic';

export interface ICoreAdapter {
  clone(org: string, library: string, branch: string, target: string): void;
  existsSync(path: string): boolean;
}

export class CoreAdapter implements ICoreAdapter {
  clone(org: string, library: string, branch: string, target: string): void {
    logic.clone(org, library, branch, target);
  }

  existsSync(path: string): boolean {
    return fs.existsSync(path);
  }
}
