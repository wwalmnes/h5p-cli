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
  vi.spyOn(console, 'log').mockImplementation(() => {});
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
});
