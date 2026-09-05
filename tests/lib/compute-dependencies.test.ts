import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDependencies } from '../../src/lib/compute-dependencies.ts';
import type { IComputeDependenciesPort, Registry } from '../../src/lib/compute-dependencies.ts';

const JOUBEL_ENTRY = {
  id: 'H5P.JoubelUI',
  shortName: 'h5p-joubel-ui',
  org: 'h5p',
  repoName: 'h5p-joubel-ui',
};

const BLANKS_ENTRY = {
  id: 'H5P.Blanks',
  shortName: 'h5p-blanks',
  org: 'h5p',
  repoName: 'h5p-blanks',
};

const JOUBEL_LIBRARY_JSON = {
  machineName: 'H5P.JoubelUI',
  title: 'Joubel UI',
  majorVersion: 3,
  minorVersion: 3,
  patchVersion: 0,
  runnable: 0,
  preloadedDependencies: [],
  editorDependencies: [],
};

const BLANKS_LIBRARY_JSON = {
  machineName: 'H5P.Blanks',
  title: 'Fill in the Blanks',
  majorVersion: 1,
  minorVersion: 14,
  patchVersion: 0,
  runnable: 1,
  preloadedDependencies: [
    { machineName: 'H5P.JoubelUI', majorVersion: 3, minorVersion: 3 },
  ],
  editorDependencies: [],
};

const EDITOR_ENTRY = {
  id: 'H5PEditor.Blanks',
  shortName: 'h5p-editor-blanks',
  org: 'h5p',
  repoName: 'h5p-editor-blanks',
};

const EDITOR_LIBRARY_JSON = {
  machineName: 'H5PEditor.Blanks',
  title: 'Blanks Editor',
  majorVersion: 1,
  minorVersion: 14,
  patchVersion: 0,
  runnable: 0,
  preloadedDependencies: [],
  editorDependencies: [],
};

const BLANKS_WITH_EDITOR_JSON = {
  ...BLANKS_LIBRARY_JSON,
  editorDependencies: [
    { machineName: 'H5PEditor.Blanks', majorVersion: 1, minorVersion: 14 },
  ],
};

function makeRegistry(entries: Record<string, typeof BLANKS_ENTRY>): Registry {
  const regular: Registry['regular'] = {};
  const reversed: Registry['reversed'] = {};
  for (const entry of Object.values(entries)) {
    const cloned = structuredClone(entry) as any;
    regular[cloned.shortName] = cloned;
    reversed[cloned.id] = cloned;
  }
  return { regular, reversed };
}

const makePort = (overrides: Partial<IComputeDependenciesPort> = {}): IComputeDependenciesPort => ({
  getRegistry: vi.fn().mockResolvedValue(makeRegistry({ joubel: JOUBEL_ENTRY, blanks: BLANKS_ENTRY })),
  parseLibraryFolders: vi.fn().mockResolvedValue({}),
  getLibraryJson: vi.fn().mockImplementation(() => Promise.resolve(structuredClone(JOUBEL_LIBRARY_JSON))),
  getSemanticsJson: vi.fn().mockResolvedValue([]),
  getTags: vi.fn().mockReturnValue([]),
  ...overrides,
});

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('computeDependencies', () => {
  it('single library with no deps resolves correctly', async () => {
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(makeRegistry({ joubel: JOUBEL_ENTRY })),
      getLibraryJson: vi.fn().mockResolvedValue(JOUBEL_LIBRARY_JSON),
    });

    const result = await computeDependencies('h5p-joubel-ui', 'view', null, undefined, port);

    expect(result['h5p-joubel-ui']).toBeDefined();
    expect(result['h5p-joubel-ui'].id).toBe('H5P.JoubelUI');
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('library with preloaded dep returns both; dep comes before parent', async () => {
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(makeRegistry({ blanks: BLANKS_ENTRY, joubel: JOUBEL_ENTRY })),
      getLibraryJson: vi.fn()
        .mockResolvedValueOnce(structuredClone(BLANKS_LIBRARY_JSON))
        .mockResolvedValueOnce(structuredClone(JOUBEL_LIBRARY_JSON)),
    });

    const result = await computeDependencies('h5p-blanks', 'view', null, undefined, port);

    expect(result['h5p-blanks']).toBeDefined();
    expect(result['h5p-joubel-ui']).toBeDefined();
    const keys = Object.keys(result);
    expect(keys.indexOf('h5p-joubel-ui')).toBeLessThan(keys.indexOf('h5p-blanks'));
  });

  it('view mode does not include editor dependencies', async () => {
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(
        makeRegistry({ blanks: BLANKS_ENTRY, joubel: JOUBEL_ENTRY, editor: EDITOR_ENTRY })
      ),
      getLibraryJson: vi.fn()
        .mockResolvedValueOnce(structuredClone(BLANKS_WITH_EDITOR_JSON))
        .mockResolvedValueOnce(structuredClone(JOUBEL_LIBRARY_JSON)),
    });

    const result = await computeDependencies('h5p-blanks', 'view', null, undefined, port);

    expect(result['h5p-editor-blanks']).toBeUndefined();
    expect(result['h5p-joubel-ui']).toBeDefined();
  });

  it('edit mode includes editor dependencies', async () => {
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(
        makeRegistry({ blanks: BLANKS_ENTRY, joubel: JOUBEL_ENTRY, editor: EDITOR_ENTRY })
      ),
      getLibraryJson: vi.fn()
        .mockResolvedValueOnce(structuredClone(BLANKS_WITH_EDITOR_JSON))
        .mockResolvedValueOnce(structuredClone(JOUBEL_LIBRARY_JSON))
        .mockResolvedValueOnce(structuredClone(EDITOR_LIBRARY_JSON)),
    });

    const result = await computeDependencies('h5p-blanks', 'edit', null, undefined, port);

    expect(result['h5p-editor-blanks']).toBeDefined();
  });

  it('dep not in registry is included with no id and correct optional flag', async () => {
    const blanksWithUnknown = {
      ...BLANKS_LIBRARY_JSON,
      preloadedDependencies: [
        { machineName: 'H5P.Unknown', majorVersion: 1, minorVersion: 0 },
      ],
    };
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(makeRegistry({ blanks: BLANKS_ENTRY })),
      getLibraryJson: vi.fn().mockImplementation(() => Promise.resolve(structuredClone(blanksWithUnknown))),
    });

    const result = await computeDependencies('h5p-blanks', 'view', null, undefined, port);

    expect(result['H5P.Unknown']).toBeDefined();
    expect(result['H5P.Unknown'].id).toBeUndefined();
    expect(result['H5P.Unknown'].optional).toBe(false);
  });

  it('throws for unregistered library when no folder provided', async () => {
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(makeRegistry({})),
    });

    await expect(
      computeDependencies('h5p-unknown', 'view', null, undefined, port)
    ).rejects.toThrow('unregistered h5p-unknown library');
  });

  it('optional dep from semantics is marked optional', async () => {
    const semanticsWithLib = [
      { type: 'library', options: ['H5P.JoubelUI 3.3'] },
    ];
    const blanksNoPreloaded = {
      ...BLANKS_LIBRARY_JSON,
      preloadedDependencies: [],
    };
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(makeRegistry({ blanks: BLANKS_ENTRY, joubel: JOUBEL_ENTRY })),
      getLibraryJson: vi.fn()
        .mockResolvedValueOnce(structuredClone(blanksNoPreloaded))
        .mockResolvedValueOnce(structuredClone(JOUBEL_LIBRARY_JSON)),
      getSemanticsJson: vi.fn()
        .mockResolvedValueOnce(semanticsWithLib)
        .mockResolvedValueOnce([]),
    });

    const result = await computeDependencies('h5p-blanks', 'view', null, undefined, port);

    expect(result['h5p-joubel-ui']).toBeDefined();
    expect(result['h5p-joubel-ui'].optional).toBe(true);
  });

  /* Tags were matched with a bare prefix test, so version 1.1 also accepted
  1.11.0 — and because getTags returns tags newest first, that wrong tag won and
  a library on 1.1.9 resolved to 1.1.0. */
  it('does not resolve a 1.1 dependency off a 1.11 tag', async () => {
    const parent = {
      machineName: 'H5P.Blanks',
      title: 'Fill in the Blanks',
      majorVersion: 1,
      minorVersion: 14,
      patchVersion: 0,
      preloadedDependencies: [{ machineName: 'H5P.JoubelUI', majorVersion: 1, minorVersion: 1 }],
      editorDependencies: [],
    };
    const child = { ...JOUBEL_LIBRARY_JSON, majorVersion: 1, minorVersion: 1, patchVersion: 9 };
    const getLibraryJson = vi.fn().mockImplementation(async (_folder, _org, repoName: string) =>
      structuredClone(repoName === 'h5p-blanks' ? parent : child));
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(makeRegistry({ blanks: BLANKS_ENTRY, joubel: JOUBEL_ENTRY })),
      getLibraryJson,
      // as logic.tags returns them: descending, so 1.11.0 is seen before 1.1.9
      getTags: vi.fn().mockReturnValue(['1.11.0', '1.1.9', '1.1.0']),
    });

    await computeDependencies('h5p-blanks', 'view', '1.14.0', undefined, port);

    const versions = getLibraryJson.mock.calls
      .filter(([, , repoName]) => repoName === 'h5p-joubel-ui')
      .map(([, , , version]) => version);
    expect(versions).toContain('1.1.9');
    expect(versions).not.toContain('1.1.0');
  });

  /* `h5p setup <lib> 1.1` is the documented way to ask for a version, but a
  bare major.minor is not a ref: the resolver passed it straight through, the
  raw host 404'd and the clone fallback died on "Remote branch 1.1 not found",
  so the versioned path never worked at all. */
  it('resolves the root library major.minor to a real tag', async () => {
    const getLibraryJson = vi.fn().mockResolvedValue(structuredClone(JOUBEL_LIBRARY_JSON));
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(makeRegistry({ joubel: JOUBEL_ENTRY })),
      getLibraryJson,
      getTags: vi.fn().mockReturnValue(['3.3.9', '3.3.1']),
    });

    await computeDependencies('h5p-joubel-ui', 'view', '3.3', undefined, port);

    expect(getLibraryJson).toHaveBeenCalledWith(undefined, 'h5p', 'h5p-joubel-ui', '3.3.9');
  });

  it('leaves a fully-qualified root version alone', async () => {
    const getLibraryJson = vi.fn().mockResolvedValue(structuredClone(JOUBEL_LIBRARY_JSON));
    const getTags = vi.fn().mockReturnValue(['3.3.9']);
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(makeRegistry({ joubel: JOUBEL_ENTRY })),
      getLibraryJson,
      getTags,
    });

    await computeDependencies('h5p-joubel-ui', 'view', '3.3.1', undefined, port);

    expect(getLibraryJson).toHaveBeenCalledWith(undefined, 'h5p', 'h5p-joubel-ui', '3.3.1');
    expect(getTags).not.toHaveBeenCalled();
  });

  /* The resolve used to be a strict chain of round trips: two reads per
  library, one library at a time. Siblings in a wave are now fetched together. */
  it('fetches the libraries in one wave concurrently', async () => {
    const parent = {
      machineName: 'H5P.Blanks',
      title: 'Fill in the Blanks',
      majorVersion: 1,
      minorVersion: 14,
      patchVersion: 0,
      preloadedDependencies: [
        { machineName: 'H5P.JoubelUI', majorVersion: 3, minorVersion: 3 },
        { machineName: 'H5PEditor.Blanks', majorVersion: 1, minorVersion: 14 },
      ],
      editorDependencies: [],
    };
    let inFlight = 0;
    let peak = 0;
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(
        makeRegistry({ blanks: BLANKS_ENTRY, joubel: JOUBEL_ENTRY, editor: EDITOR_ENTRY })),
      getLibraryJson: vi.fn().mockImplementation(async (_folder, _org, repoName: string) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise(resolve => setTimeout(resolve, 5));
        inFlight--;
        if (repoName === 'h5p-blanks') return structuredClone(parent);
        if (repoName === 'h5p-editor-blanks') return structuredClone(EDITOR_LIBRARY_JSON);
        return structuredClone(JOUBEL_LIBRARY_JSON);
      }),
    });

    const result = await computeDependencies('h5p-blanks', 'view', null, undefined, port);

    // both children sit in the same wave, so both reads are open at once
    expect(peak).toBe(2);
    expect(Object.keys(result).sort()).toEqual(['h5p-blanks', 'h5p-editor-blanks', 'h5p-joubel-ui']);
  });

  /* Prefetch is best-effort warming; a failure there must not change how or
  where the resolve reports the problem. */
  it('still reports a missing library.json when the prefetch fails', async () => {
    const port = makePort({
      getRegistry: vi.fn().mockResolvedValue(makeRegistry({ joubel: JOUBEL_ENTRY })),
      getLibraryJson: vi.fn().mockResolvedValue({}),
    });

    await expect(computeDependencies('h5p-joubel-ui', 'view', null, undefined, port))
      .rejects.toThrow('missing library.json for h5p-joubel-ui');
  });
});
