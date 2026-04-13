import * as fs from 'fs';
import logic from '../../logic.ts';

export interface IRegisterAdapter {
  getRegistry(): Promise<{ regular: Record<string, any>; reversed: Record<string, any> }>;
  registryEntryFromRepoUrl(gitUrl: string): Record<string, any>;
  readJsonFile(path: string): Record<string, any>;
  writeJsonFile(path: string, data: Record<string, any>): void;
}

export class RegisterAdapter implements IRegisterAdapter {
  getRegistry(): Promise<{ regular: Record<string, any>; reversed: Record<string, any> }> {
    return logic.getRegistry();
  }

  registryEntryFromRepoUrl(gitUrl: string): Record<string, any> {
    return logic.registryEntryFromRepoUrl(gitUrl);
  }

  readJsonFile(path: string): Record<string, any> {
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  }

  writeJsonFile(path: string, data: Record<string, any>): void {
    fs.writeFileSync(path, JSON.stringify(data));
  }
}
