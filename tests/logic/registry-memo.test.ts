import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

/* getRegistry fetches the registry at most once per process.

Nothing in the normal `h5p setup` flow creates libraryRegistry.json — only
`h5p list 1` and `h5p register` write it — so a plain workspace has no file and
every getRegistry is a 40 KB download. computeDependencies asks for the registry
too, so one editor request was ~35 of them in series.

Two things the cache must not break, both pinned below: the file is still read
fresh every call (`h5p setup <git-url>` registers the library, writes the file,
then resolves its graph and has to see what register just wrote), and each
caller still gets its own copy of the entries (computeDependencies writes
*through* the registry it is handed).

superagent is mocked at the module level; fetchImpl decides per URL, so the
registry can answer while metadata reads fail over to the clone transport, where
the seeded temp/<repo>_master folders answer and nothing is cloned. */
const fetchCalls: string[] = [];
let fetchImpl: (url: string) => Promise<any> = async () => {
  throw new Error('ENOTFOUND');
};

vi.mock('superagent', () => ({
  default: {
    get: (url: string) => {
      fetchCalls.push(url);
      const chain: any = { set: () => chain, ok: () => fetchImpl(url) };
      return chain;
    },
  },
}));

const REGISTRY_URL = 'https://raw.githubusercontent.com/h5p/h5p-registry/main/libraries.json';

const REGISTRY_DATA = {
  'H5P.Blanks': { id: 'H5P.Blanks', shortName: 'h5p-blanks', org: 'h5p', repoName: 'h5p-blanks' },
  'H5P.JoubelUI': { id: 'H5P.JoubelUI', shortName: 'h5p-joubel-ui', org: 'h5p', repoName: 'h5p-joubel-ui' },
};

const BLANKS_LIBRARY_JSON = {
  machineName: 'H5P.Blanks',
  title: 'Fill in the Blanks',
  majorVersion: 1,
  minorVersion: 14,
  patchVersion: 0,
  runnable: 1,
  preloadedDependencies: [{ machineName: 'H5P.JoubelUI', majorVersion: 3, minorVersion: 3 }],
};

const JOUBEL_LIBRARY_JSON = {
  machineName: 'H5P.JoubelUI',
  title: 'Joubel UI',
  majorVersion: 3,
  minorVersion: 3,
  patchVersion: 0,
  runnable: 0,
};

/* The cache is module state, so every test loads its own copy of logic.ts —
otherwise the first test's fetch would answer the rest of them. */
const freshLogic = async () => {
  vi.resetModules();
  return (await import('../../logic.ts')).default;
};

const serveRegistry = () => {
  fetchImpl = async (url: string) => {
    if (url === REGISTRY_URL) {
      return { status: 200, text: JSON.stringify(REGISTRY_DATA) };
    }
    throw new Error('ENOTFOUND');
  };
};

describe('registry fetch caching', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    fs.mkdirSync('libraries', { recursive: true });
    fs.mkdirSync('temp', { recursive: true });
    fetchCalls.length = 0;
    fetchImpl = async () => { throw new Error('ENOTFOUND'); };
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  const writeRegistryFile = (data: object = REGISTRY_DATA) =>
    fs.writeFileSync('libraryRegistry.json', JSON.stringify(data));

  const setupTempDir = (repoName: string, libraryJson: object, semanticsJson: unknown = []) => {
    const dir = `temp/${repoName}_master`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/library.json`, JSON.stringify(libraryJson));
    fs.writeFileSync(`${dir}/semantics.json`, JSON.stringify(semanticsJson));
  };

  it('fetches once, however many callers ask', async () => {
    serveRegistry();
    const logic = await freshLogic();

    await Promise.all(Array.from({ length: 10 }, () => logic.getRegistry()));
    await logic.getRegistry();

    expect(fetchCalls.filter((url) => url === REGISTRY_URL)).toHaveLength(1);
  });

  it('retries a failed fetch instead of remembering it', async () => {
    // caching the failure would leave the process with a permanently empty registry
    const logic = await freshLogic();

    await logic.getRegistry().catch(() => undefined);
    await logic.getRegistry().catch(() => undefined);

    expect(fetchCalls.filter((url) => url === REGISTRY_URL)).toHaveLength(2);
  });

  it('leaves no libraryRegistry.json behind on a plain read', async () => {
    /* Only `h5p list 1` writes the file. If a plain read cached the fetch to
    disk, the first command in a fresh workspace would pin the registry and
    newly published libraries would stop appearing. */
    serveRegistry();
    const logic = await freshLogic();

    const registry = await logic.getRegistry();

    expect(registry.regular['h5p-blanks']).toBeDefined();
    expect(fs.existsSync('libraryRegistry.json')).toBe(false);
  });

  it('sees a registry entry written after an earlier read in the same process', async () => {
    /* `h5p setup <git-url>` registers the library, which writes
    libraryRegistry.json, and then resolves its graph. computeDependencies calls
    getRegistry again and must see the entry register just added, or it throws
    "unregistered <library> library" for every repo not already in the public
    registry. */
    writeRegistryFile();
    const logic = await freshLogic();

    const first = await logic.getRegistry();
    expect(first.regular['h5p-new-thing']).toBeUndefined();

    // what RegisterService.register writes: the reversed map plus the new entry
    writeRegistryFile({
      ...first.reversed,
      'H5P.NewThing': { id: 'H5P.NewThing', shortName: 'h5p-new-thing', org: 'me', repoName: 'h5p-new-thing' },
    });

    const second = await logic.getRegistry();
    expect(second.regular['h5p-new-thing']).toBeDefined();
  });

  it('hands each caller its own copy of the cached entries', async () => {
    serveRegistry();
    const logic = await freshLogic();

    const first = await logic.getRegistry();
    const second = await logic.getRegistry();
    expect(second.regular['h5p-blanks']).toEqual(first.regular['h5p-blanks']);
    expect(second.regular['h5p-blanks']).not.toBe(first.regular['h5p-blanks']);

    // the write computeDependencies performs must not reach the next caller
    (first.regular['h5p-blanks'] as any).requiredBy = ['/h5p-blanks'];
    const third = await logic.getRegistry();
    expect((third.regular['h5p-blanks'] as any).requiredBy).toBeUndefined();
  });

  it('resolves the same graph identically twice against a cached registry', async () => {
    serveRegistry();
    setupTempDir('h5p-blanks', BLANKS_LIBRARY_JSON);
    setupTempDir('h5p-joubel-ui', JOUBEL_LIBRARY_JSON);
    const logic = await freshLogic();

    const first = await logic.computeDependencies('h5p-blanks', 'view');
    const second = await logic.computeDependencies('h5p-blanks', 'view');

    /* without the per-call copy, accumulated requiredBy makes the second
    resolution prune h5p-joubel-ui as an already-seen path */
    expect(Object.keys(second)).toEqual(Object.keys(first));
    expect(second['h5p-joubel-ui']?.id).toBe('H5P.JoubelUI');
    expect(second['h5p-blanks']?.id).toBe('H5P.Blanks');
  });
});
