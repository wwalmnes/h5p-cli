import { IRegisterAdapter } from '../adapters/register-adapter';

export class RegisterService {
  constructor(
    private adapter: IRegisterAdapter,
    private registryPath: string
  ) {}

  async register(input: string): Promise<Record<string, any>> {
    const isUrl = ['http', 'git@'].includes(input.slice(0, 4));
    const registry = await this.adapter.getRegistry();
    const entry = isUrl
      ? await this.adapter.registryEntryFromRepoUrl(input)
      : this.adapter.readJsonFile(input);
    registry.reversed = { ...registry.reversed, ...entry };
    this.adapter.writeJsonFile(this.registryPath, registry.reversed);
    console.log('> updated registry entry');
    console.log(entry);
    return entry;
  }
}
