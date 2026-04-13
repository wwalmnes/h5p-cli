import type { ILibraryInstallAdapter } from '../adapters/library-install-adapter.ts';

function sshToHttps(url: string): string {
  return url.replace('git@github.com:', 'https://github.com/');
}

export class LibraryInstallService {
  private adapter: ILibraryInstallAdapter;

  constructor(adapter: ILibraryInstallAdapter) {
    this.adapter = adapter;
  }

  async resolveCollection(libraries: string[]): Promise<Map<string, { repository: string }>> {
    const registry = await this.adapter.fetchRegistry();
    const collection = new Map<string, { repository: string }>();
    await Promise.all(libraries.filter(l => l !== '').map(l => this._addToCollection(l, registry, collection)));
    return collection;
  }

  async cloneLibrary(
    name: string,
    url: string,
    fetchWithHttps: boolean,
  ): Promise<{ status: 'ok' | 'skipped' | 'failed'; error?: string }> {
    const resolvedUrl = fetchWithHttps ? sshToHttps(url) : url;
    const result = await this.adapter.cloneRepository(name, resolvedUrl);
    if (result === null) return { status: 'ok' };
    if (result === '-1') return { status: 'skipped' };
    return { status: 'failed', error: result };
  }

  private async _addToCollection(
    libraryName: string,
    registry: Record<string, any>,
    collection: Map<string, { repository: string }>,
  ): Promise<void> {
    if (collection.has(libraryName)) return;

    const library = registry[libraryName];
    if (!library) throw new Error(`No such library: ${libraryName}`);

    collection.set(libraryName, library);

    if (library.dependencies?.length) {
      await Promise.all(
        library.dependencies.map((dep: string) => this._addToCollection(dep, registry, collection)),
      );
    }
  }
}
