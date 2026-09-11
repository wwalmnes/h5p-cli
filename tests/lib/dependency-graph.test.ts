import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDependencies } from '../../src/lib/compute-dependencies.ts';
import type { IComputeDependenciesPort, Registry, DependencyMap } from '../../src/lib/compute-dependencies.ts';

/* `h5p setup`, `h5p missing` and the content commands (`logic.export`,
`logic.verifySetup`, `logic.generateInfo`) each perform a single edit
resolution. They used to assemble their result out of several traversals of the
same graph - a view pass, then edit passes rooted at the library or at every
library in it - and one pass is only enough because of two properties of the
resolver: `mode` is applied at every node rather than only at the root, and view
edges (preloadedDependencies + the libraries named in semantics.json) are a
subset of edit edges (those plus editorDependencies). This pins both, and what
the callers read off the result, against a graph shaped to break them. */

type Lib = {
  machineName: string;
  preloaded?: string[];
  editor?: string[];
  semantics?: string[];
};

/* Registered libraries. The unregistered ones are only ever named as
dependencies:

  H5P.Req                - preloaded straight off the root, so required
  H5P.Missing            - named in the root's semantics.json, so optional
  H5P.Deep               - preloaded by h5p-opt, which the root itself only
                           reaches through semantics.json
  H5P.EditorOnlyMissing  - preloaded by an editor dependency of h5p-sub, so
                           reachable in edit mode only

Around them: an editor dependency hanging off a *view* dependency
(H5PEditor.Common), an editor library with preloaded dependencies of its own
(H5PEditor.Root), a diamond (H5P.Common, reached from the root and from h5p-sub),
libraries reachable only through semantics.json (h5p-opt, h5p-sub) and a cycle
back to the root (h5p-cyclic). */
const GRAPH: Record<string, Lib> = {
  'h5p-root':          { machineName: 'H5P.Root', preloaded: ['H5P.Common', 'H5P.Req'], editor: ['H5PEditor.Root'], semantics: ['H5P.Opt', 'H5P.Sub', 'H5P.Missing'] },
  'h5p-common':        { machineName: 'H5P.Common', editor: ['H5PEditor.Common'] },
  'h5p-opt':           { machineName: 'H5P.Opt', preloaded: ['H5P.Deep'] },
  'h5p-sub':           { machineName: 'H5P.Sub', preloaded: ['H5P.Common'], editor: ['H5PEditor.Sub'], semantics: ['H5P.Cyclic'] },
  'h5p-cyclic':        { machineName: 'H5P.Cyclic', preloaded: ['H5P.Root'] },
  'h5p-editor-root':   { machineName: 'H5PEditor.Root', preloaded: ['H5PEditor.Widget'] },
  'h5p-editor-common': { machineName: 'H5PEditor.Common' },
  'h5p-editor-sub':    { machineName: 'H5PEditor.Sub', preloaded: ['H5P.EditorOnlyMissing'] },
  'h5p-editor-widget': { machineName: 'H5PEditor.Widget' },
};

/* What parseLibraryFolders returns: machineName -> installed folder. A non-empty
map is what makes compute() take its `folder ? libraryDirs[...] : null` branch
for every child, so the whole traversal runs off local folders the way it does
under export/verifySetup/generateInfo. */
const LIBRARY_DIRS: Record<string, string> = Object.fromEntries(
  Object.values(GRAPH).map(lib => [lib.machineName, `${lib.machineName}-1.0`])
);

const ROOT_FOLDER = LIBRARY_DIRS['H5P.Root'];

/* Fresh objects per call, because computeDependencies records requiredBy paths
on the registry entries it walks. logic.getRegistry hands out a new object per
call; a shared fake would let one traversal's bookkeeping suppress the next
one's. */
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

const makePort = (libraryDirs: Record<string, string> = {}): IComputeDependenciesPort => ({
  getRegistry: vi.fn().mockImplementation(async () => makeRegistry()),
  parseLibraryFolders: vi.fn().mockResolvedValue({ ...libraryDirs }),
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

// from the repos, the way setup and missing call the resolver
const resolve = (mode: 'view' | 'edit', port = makePort()): Promise<DependencyMap> =>
  computeDependencies('h5p-root', mode, null, undefined, port);

// from installed folders, the way the content commands call it
const resolveLocal = (mode: 'view' | 'edit', port = makePort(LIBRARY_DIRS)): Promise<DependencyMap> =>
  computeDependencies('h5p-root', mode, null, ROOT_FOLDER, port);

/* Only the libraries an install pass would actually fetch: entries without an
id are the unregistered ones, which are reported rather than installed. */
const installable = (map: DependencyMap): string[] =>
  Object.keys(map).filter(key => map[key].id).sort();

// how MissingService reads the flag: no flag means required
const optional = (map: DependencyMap, key: string): boolean => map[key].optional ?? false;

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dependency graph', () => {
  it('reaches every registered library in one edit resolution, including an editor dependency of a view dependency', async () => {
    const edit = await resolve('edit');

    expect(installable(edit)).toEqual(Object.keys(GRAPH).sort());
  });

  it('an edit resolution contains every key the view resolution has', async () => {
    const port = makePort(LIBRARY_DIRS);

    const view = await resolveLocal('view', port);
    const edit = await resolveLocal('edit', port);

    expect({ ...view, ...edit }).toEqual(edit);
    // guard against a vacuous pass: the view pass really did resolve something
    expect(Object.keys(view).length).toBeGreaterThan(0);
    expect(Object.keys(edit).length).toBeGreaterThan(Object.keys(view).length);
  });

  it('reads every library.json from an installed folder when given one', async () => {
    const port = makePort(LIBRARY_DIRS);

    await resolveLocal('edit', port);

    /* this is the branch a null libraryDirs would silently skip, taking the
    whole graph back over the network */
    const folders = (port.getLibraryJson as any).mock.calls.map((call: unknown[]) => call[0]);
    expect(folders).toContain(ROOT_FOLDER);
    expect(folders.every((folder: unknown) => typeof folder === 'string' && folder.length)).toBe(true);
  });

  it('reports unregistered dependencies with no id', async () => {
    const edit = await resolveLocal('edit');

    // named in the root's semantics.json, so optional
    expect(edit['H5P.Missing']).toBeDefined();
    expect(edit['H5P.Missing'].id).toBeUndefined();
    expect(edit['H5P.Missing'].optional).toBe(true);
    // preloaded by an editor dependency, so reachable in edit mode only
    expect(edit['H5P.EditorOnlyMissing']).toBeDefined();
    expect(edit['H5P.EditorOnlyMissing'].id).toBeUndefined();
    expect((await resolveLocal('view'))['H5P.EditorOnlyMissing']).toBeUndefined();
  });

  it('flags a dependency preloaded off the root as required and one named in semantics as optional', async () => {
    const edit = await resolve('edit');

    expect(optional(edit, 'H5P.Req')).toBe(false);
    expect(optional(edit, 'H5P.Missing')).toBe(true);
  });

  /* isOptional reads optionality off the parent, so an unregistered dependency
  below an optional library inherits it down the chain it actually arrived on.
  The old per-item passes re-rooted h5p-opt and h5p-sub, left them with no
  parent, and reported these two as required. */
  it('inherits optionality below an optional parent', async () => {
    const edit = await resolve('edit');

    expect(optional(edit, 'H5P.Deep')).toBe(true);
    expect(optional(edit, 'H5P.EditorOnlyMissing')).toBe(true);
  });
});
