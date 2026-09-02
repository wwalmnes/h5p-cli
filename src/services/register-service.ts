import type { IRegisterAdapter } from '../adapters/register-adapter.ts';
import { ui } from '../lib/ui.ts';

export class RegisterService {
  private adapter: IRegisterAdapter;
  private registryPath: string;

  constructor(adapter: IRegisterAdapter, registryPath: string) {
    this.adapter = adapter;
    this.registryPath = registryPath;
  }

  async register(input: string): Promise<Record<string, any>> {
    const isUrl = ['http', 'git@'].includes(input.slice(0, 4));
    const registry = await this.adapter.getRegistry();
    const entry = isUrl
      ? await this.adapter.registryEntryFromRepoUrl(input)
      : this.adapter.readJsonFile(input);
    registry.reversed = { ...registry.reversed, ...entry };
    this.adapter.writeJsonFile(this.registryPath, registry.reversed);
    ui.success('updated registry entry');
    ui.data(JSON.stringify(entry, null, 2));
    return entry;
  }
}
