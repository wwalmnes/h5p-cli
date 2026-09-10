import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDependencies } from '../../src/lib/compute-dependencies.ts';
import type { IComputeDependenciesPort, Registry, DependencyMap } from '../../src/lib/compute-dependencies.ts';

/* `h5p missing` used to assemble its report out of N+2 traversals: the view
graph, then an edit graph rooted at every registered library in it, then the
root's edit graph. It now performs a single edit resolution.

That collapse rests on the same two properties of the resolver `h5p setup`
relies on (see setup-graph-equivalence.test.ts): `mode` is applied at every node
rather than only at the root, and view edges are a subset of edit edges. What
this file pins is the part specific to `missing` - the set of *unregistered*
libraries reported, and the optional/required flag each one is reported with. */

type Lib = {
  machineName: string;
  preloaded?: string[];
  editor?: string[];
  semantics?: string[];
};

/* Registered libraries. The unregistered ones are only ever named as
dependencies, which is what puts them in the report:

  H5P.Req                - preloaded straight off the root, so required
  H5P.Missing            - named in the root's semantics.json, so optional
  H5P.Deep               - preloaded by h5p-opt, which the root itself only
                           reaches through semantics.json
  H5P.EditorOnlyMissing  - preloaded by an editor dependency of h5p-sub, so
                           reachable in edit mode only

The last two are the ones the old orchestration mis-flagged: a per-item pass
made h5p-opt / h5p-sub a root, and a root has no parent, so their optionality
was dropped before it could be inherited. */
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

/* Fresh objects per call, because computeDependencies records requiredBy paths
on the registry entries it walks. logic.getRegistry re-reads the file every
time, so production hands out a new object per call; a shared fake would let one
traversal's bookkeeping suppress the next one's. */
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

/* What MissingService reports now: every entry the resolution produced that the
registry does not know about, keyed by name, valued by its optional flag. */
const report = (map: DependencyMap): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const item in map) {
    if (map[item].id) {
      continue;
    }
    output[item] = map[item].optional ?? false;
  }
  return output;
};

// the N+2 orchestration MissingService used to run, verbatim
async function legacyReport(library: string, port: IComputeDependenciesPort): Promise<Record<string, boolean>> {
  const registry = makeRegistry();
  const missing: Record<string, boolean> = {};
  const parseMissing = (result: DependencyMap, item: string) => {
    if (!registry.regular[item] && (typeof missing[item] === 'undefined' || missing[item])) {
      missing[item] = result[item].optional!;
    }
  };
  let result = await computeDependencies(library, 'view', undefined, undefined, port);
  for (const item in result) {
    parseMissing(result, item);
    if (registry.regular[item]) {
      const list = await computeDependencies(item, 'edit', undefined, undefined, port);
      for (const elem in list) {
        parseMissing(list, elem);
      }
    }
  }
  result = await computeDependencies(library, 'edit', undefined, undefined, port);
  for (const item in result) {
    parseMissing(result, item);
  }
  return missing;
}

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('missing dependency graph', () => {
  it('one edit resolution reports the same libraries the old N+2 orchestration did', async () => {
    const legacy = await legacyReport('h5p-root', makePort());
    const current = report(await computeDependencies('h5p-root', 'edit', undefined, undefined, makePort()));

    expect(Object.keys(current).sort()).toEqual(Object.keys(legacy).sort());
    // guard against both sides collapsing to nothing and passing vacuously
    expect(Object.keys(current).sort()).toEqual([
      'H5P.Deep',
      'H5P.EditorOnlyMissing',
      'H5P.Missing',
      'H5P.Req',
    ]);
  });

  it('keeps the flags the old orchestration got right', async () => {
    const legacy = await legacyReport('h5p-root', makePort());
    const current = report(await computeDependencies('h5p-root', 'edit', undefined, undefined, makePort()));

    // preloaded straight off the root
    expect(legacy['H5P.Req']).toBe(false);
    expect(current['H5P.Req']).toBe(false);
    // named in the root's semantics.json
    expect(legacy['H5P.Missing']).toBe(true);
    expect(current['H5P.Missing']).toBe(true);
  });

  /* The one deliberate difference. Re-rooting a library in a per-item pass gave
  it no parent, and isOptional() reads optionality off the parent, so an
  optional library came back required and every unregistered dependency below it
  inherited that. The single traversal never re-roots, so optionality inherits
  down the chain it actually arrived on. */
  it('reports a dependency below an optional parent as optional, where it used to say required', async () => {
    const legacy = await legacyReport('h5p-root', makePort());
    const current = report(await computeDependencies('h5p-root', 'edit', undefined, undefined, makePort()));

    expect(legacy['H5P.Deep']).toBe(false);
    expect(current['H5P.Deep']).toBe(true);

    expect(legacy['H5P.EditorOnlyMissing']).toBe(false);
    expect(current['H5P.EditorOnlyMissing']).toBe(true);
  });
});
