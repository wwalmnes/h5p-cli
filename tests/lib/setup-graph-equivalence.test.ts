import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDependencies } from '../../src/lib/compute-dependencies.ts';
import type { IComputeDependenciesPort, Registry, DependencyMap } from '../../src/lib/compute-dependencies.ts';

/* `h5p setup` used to assemble its install set out of N+4 traversals: the view
graph, then an edit graph rooted at every library in it, then the root's edit
graph, then the view and edit graphs again with the skip list reset. It now
performs a single edit resolution.

That collapse is only safe if one edit graph rooted at the library equals the
union of all of those, which rests on two properties of the resolver: `mode` is
applied at every node rather than only at the root, and view edges
(preloadedDependencies + the libraries named in semantics.json) are a subset of
edit edges (those plus editorDependencies). This pins the conclusion against a
graph built to break it. */

type Lib = {
  machineName: string;
  preloaded?: string[];
  editor?: string[];
  semantics?: string[];
};

/* Shaped to exercise every case that could make the union bigger than the edit
graph: an editor dependency hanging off a *view* dependency (only the old
per-item pass reached commonEditor directly), an editor library with preloaded
dependencies of its own, a diamond, a library reachable only through
semantics.json, a cycle back to the root, and an unregistered optional. */
const GRAPH: Record<string, Lib> = {
  'h5p-root':          { machineName: 'H5P.Root', preloaded: ['H5P.Common'], editor: ['H5PEditor.Root'], semantics: ['H5P.Sub', 'H5P.Missing'] },
  'h5p-common':        { machineName: 'H5P.Common', editor: ['H5PEditor.Common'] },
  'h5p-sub':           { machineName: 'H5P.Sub', preloaded: ['H5P.Common'], editor: ['H5PEditor.Sub'], semantics: ['H5P.Cyclic'] },
  'h5p-cyclic':        { machineName: 'H5P.Cyclic', preloaded: ['H5P.Root'] },
  'h5p-editor-root':   { machineName: 'H5PEditor.Root', preloaded: ['H5PEditor.Widget'] },
  'h5p-editor-common': { machineName: 'H5PEditor.Common' },
  'h5p-editor-sub':    { machineName: 'H5PEditor.Sub' },
  'h5p-editor-widget': { machineName: 'H5PEditor.Widget' },
};

const shortNameOf = (machineName: string): string =>
  Object.keys(GRAPH).find(key => GRAPH[key].machineName === machineName)!;

/* Fresh objects per call, because computeDependencies records requiredBy paths
on the registry entries it walks. logic.getRegistry re-reads the file every
time, so production hands out a new object per call; a shared fake would let
one traversal's bookkeeping suppress the next one's. */
function makeRegistry(): Registry {
  const regular: Registry['regular'] = {};
  const reversed: Registry['reversed'] = {};
  for (const [shortName, lib] of Object.entries(GRAPH)) {
    const entry = { id: lib.machineName, shortName, org: 'h5p', repoName: shortName } as any;
    regular[shortName] = entry;
    reversed[lib.machineName] = entry;
  }
  return { regular, reversed };
}

const makePort = (): IComputeDependenciesPort => ({
  getRegistry: vi.fn().mockImplementation(async () => makeRegistry()),
  parseLibraryFolders: vi.fn().mockResolvedValue({}),
  getTags: vi.fn().mockReturnValue([]),
  getLibraryJson: vi.fn().mockImplementation(async (_folder, _org, repoName: string) => {
    const lib = GRAPH[repoName];
    return {
      machineName: lib.machineName,
      title: lib.machineName,
      majorVersion: 1,
      minorVersion: 0,
      patchVersion: 0,
      runnable: 0,
      preloadedDependencies: (lib.preloaded ?? []).map(machineName => ({ machineName, majorVersion: 1, minorVersion: 0 })),
      editorDependencies: (lib.editor ?? []).map(machineName => ({ machineName, majorVersion: 1, minorVersion: 0 })),
    };
  }),
  getSemanticsJson: vi.fn().mockImplementation(async (_folder, _org, repoName: string) => {
    const names = GRAPH[repoName].semantics ?? [];
    return names.length ? [{ type: 'library', options: names.map(name => `${name} 1.0`) }] : [];
  }),
});

/* Only the libraries an install pass would actually fetch: entries without an
id are the unregistered ones, which are reported rather than installed. */
const installable = (map: DependencyMap): string[] =>
  Object.keys(map).filter(key => map[key].id).sort();

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('setup dependency graph', () => {
  it('one edit resolution installs exactly what the old N+4 orchestration did', async () => {
    const port = makePort();

    // what SetupService used to do, in order
    const legacy = new Set<string>();
    const viewGraph = await computeDependencies('h5p-root', 'view', undefined, undefined, port);
    for (const item of Object.keys(viewGraph)) {
      if (!viewGraph[item].id) {
        continue;
      }
      for (const key of installable(await computeDependencies(item, 'edit', undefined, undefined, port))) {
        legacy.add(key);
      }
    }
    for (const key of installable(await computeDependencies('h5p-root', 'view', undefined, undefined, port))) {
      legacy.add(key);
    }
    for (const key of installable(await computeDependencies('h5p-root', 'edit', undefined, undefined, port))) {
      legacy.add(key);
    }

    // what it does now
    const current = installable(await computeDependencies('h5p-root', 'edit', undefined, undefined, port));

    expect(current).toEqual([...legacy].sort());
    // guard against both sides collapsing to nothing and passing vacuously
    expect(current).toEqual(Object.keys(GRAPH).sort());
  });

  it('still reports the unregistered optional the old pre-pass surfaced', async () => {
    const result = await computeDependencies('h5p-root', 'edit', undefined, undefined, makePort());

    expect(result['H5P.Missing']).toBeDefined();
    expect(result['H5P.Missing'].id).toBeUndefined();
    expect(result['H5P.Missing'].optional).toBe(true);
  });

  it('the edit graph is a superset of the view graph, which is what makes one pass enough', async () => {
    const port = makePort();
    const view = installable(await computeDependencies('h5p-root', 'view', undefined, undefined, port));
    const edit = installable(await computeDependencies('h5p-root', 'edit', undefined, undefined, port));

    expect(view.every(key => edit.includes(key))).toBe(true);
    expect(edit.length).toBeGreaterThan(view.length);
  });
});
