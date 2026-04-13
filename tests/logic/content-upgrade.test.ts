import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { upgradeContent } from '../../logic-content-upgrade.cjs';

// --- helpers ---

function makeLibraryField(name: string, major: number, minor: number, innerParams: object = {}) {
  return { library: `${name} ${major}.${minor}`, params: innerParams };
}

function makeGetLatest(map: Record<string, { major: number; minor: number }>) {
  return (name: string) => map[name] ?? { major: 1, minor: 0 };
}

// ---

describe('upgradeContent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('passthrough', () => {
    it('returns a plain object with no library fields unchanged', () => {
      const params = { text: 'hello', count: 3 };
      const result = upgradeContent(params, () => ({}), () => ({ major: 1, minor: 0 }));
      expect(result).toEqual({ text: 'hello', count: 3 });
    });

    it('returns null when params is null', () => {
      const result = upgradeContent(null, () => ({}), () => ({ major: 1, minor: 0 }));
      expect(result).toBeNull();
    });

    it('returns a primitive string unchanged', () => {
      const result = upgradeContent('hello' as any, () => ({}), () => ({ major: 1, minor: 0 }));
      expect(result).toBe('hello');
    });
  });

  describe('buildLibraryInfo — via processField', () => {
    it('throws for a library string with no version', () => {
      const field = { library: 'NOT_VALID', params: {} };
      expect(() =>
        upgradeContent(field, () => ({}), () => ({ major: 1, minor: 0 }))
      ).toThrow('Invalid versioned name: NOT_VALID');
    });

    it('throws for a library string with a non-numeric version', () => {
      const field = { library: 'H5P.Blanks 1.x', params: {} };
      expect(() =>
        upgradeContent(field, () => ({}), () => ({ major: 1, minor: 0 }))
      ).toThrow('Invalid versioned name: H5P.Blanks 1.x');
    });
  });

  describe('upgradeParams — callback interface', () => {
    it('replaces params when callback is called with (null, upgradedParams)', () => {
      const field = makeLibraryField('H5P.Blanks', 1, 13, { text: 'original' });
      const upgrades = { 1: { 14: (p: any, done: Function) => done(null, { ...p, upgraded: true }) } };
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 14 } });

      const result = upgradeContent(field, () => upgrades, getLatest);

      expect(result.params.upgraded).toBe(true);
      expect(result.params.text).toBe('original');
    });

    it('updates metadata when upgradedExtras.metadata is provided in callback', () => {
      const field = {
        library: 'H5P.Blanks 1.13',
        params: { text: 'hi' },
        metadata: { title: 'Old Title' },
      };
      const upgrades = {
        1: {
          14: (p: any, done: Function, extras: any) =>
            done(null, p, { metadata: { title: 'New Title' } }),
        },
      };
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 14 } });

      const result = upgradeContent(field, () => upgrades, getLatest);

      expect(result.metadata.title).toBe('New Title');
    });

    it('does not throw when callback signals an error — preserves original params', () => {
      const field = makeLibraryField('H5P.Blanks', 1, 13, { text: 'original' });
      const upgrades = {
        1: { 14: (p: any, done: Function) => done(new Error('upgrade failed')) },
      };
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 14 } });

      expect(() => upgradeContent(field, () => upgrades, getLatest)).not.toThrow();
      const result = upgradeContent(field, () => upgrades, getLatest);
      expect(result.params.text).toBe('original');
      expect(result.params.upgraded).toBeUndefined();
    });

    it('does not throw when upgrade function throws synchronously — preserves original params', () => {
      const field = makeLibraryField('H5P.Blanks', 1, 13, { text: 'original' });
      const upgrades = {
        1: { 14: () => { throw new Error('unexpected'); } },
      };
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 14 } });

      expect(() => upgradeContent(field, () => upgrades, getLatest)).not.toThrow();
      const result = upgradeContent(field, () => upgrades, getLatest);
      expect(result.params.text).toBe('original');
    });

    it('does not mutate the original params object', () => {
      const innerParams = { text: 'original' };
      const field = { library: 'H5P.Blanks 1.13', params: innerParams };
      const upgrades = {
        1: { 14: (p: any, done: Function) => done(null, { ...p, upgraded: true }) },
      };
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 14 } });

      upgradeContent(field, () => upgrades, getLatest);

      expect(innerParams).toEqual({ text: 'original' });
    });
  });

  describe('processParams — version filtering', () => {
    it('skips an upgrade function whose minor is equal to the current minor (same major)', () => {
      const spy = vi.fn((p: any, done: Function) => done(null, p));
      const field = makeLibraryField('H5P.Blanks', 1, 14, {}); // current: 1.14
      const upgrades = { 1: { 14: spy } }; // upgrade AT 1.14 — not newer, should be skipped
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 14 } });

      upgradeContent(field, () => upgrades, getLatest);

      expect(spy).not.toHaveBeenCalled();
    });

    it('applies an upgrade function whose minor is greater than the current minor', () => {
      const spy = vi.fn((p: any, done: Function) => done(null, p));
      const field = makeLibraryField('H5P.Blanks', 1, 13, {}); // current: 1.13
      const upgrades = { 1: { 14: spy } }; // upgrade at 1.14
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 14 } });

      upgradeContent(field, () => upgrades, getLatest);

      expect(spy).toHaveBeenCalledOnce();
    });

    it('applies multiple minor-version upgrade functions in ascending order', () => {
      const callOrder: number[] = [];
      const upgrades = {
        1: {
          12: (p: any, done: Function) => { callOrder.push(12); done(null, p); },
          14: (p: any, done: Function) => { callOrder.push(14); done(null, p); },
          13: (p: any, done: Function) => { callOrder.push(13); done(null, p); },
        },
      };
      const field = makeLibraryField('H5P.Blanks', 1, 11, {}); // current: 1.11
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 14 } });

      upgradeContent(field, () => upgrades, getLatest);

      expect(callOrder).toEqual([12, 13, 14]);
    });

    it('skips an upgrade function whose major exceeds targetVersion.major', () => {
      const spy = vi.fn((p: any, done: Function) => done(null, p));
      const field = makeLibraryField('H5P.Blanks', 1, 0, {}); // current: 1.0
      const upgrades = { 2: { 0: spy } }; // upgrade at 2.0
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 2, minor: 0 } });

      upgradeContent(field, () => upgrades, getLatest, { major: 1, minor: 99 }); // cap at 1.x

      expect(spy).not.toHaveBeenCalled();
    });

    it('applies a major-version upgrade when no targetVersion restriction is set', () => {
      const spy = vi.fn((p: any, done: Function) => done(null, p));
      const field = makeLibraryField('H5P.Blanks', 1, 0, {}); // current: 1.0
      const upgrades = { 2: { 0: spy } }; // upgrade at 2.0
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 2, minor: 0 } });

      upgradeContent(field, () => upgrades, getLatest); // no targetVersion restriction

      expect(spy).toHaveBeenCalledOnce();
    });

    it('skips an upgrade function whose minor exceeds targetVersion.minor (same major)', () => {
      const spy = vi.fn((p: any, done: Function) => done(null, p));
      const field = makeLibraryField('H5P.Blanks', 1, 10, {}); // current: 1.10
      const upgrades = { 1: { 15: spy } }; // upgrade at 1.15
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 15 } });

      upgradeContent(field, () => upgrades, getLatest, { major: 1, minor: 13 }); // cap at 1.13

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('processField — recursion', () => {
    it('processes child params before parent (depth-first)', () => {
      const callOrder: string[] = [];
      const field = {
        library: 'H5P.Parent 1.0',
        params: {
          library: 'H5P.Child 1.0',
          params: {},
        },
      };
      const childSpy = vi.fn((p: any, done: Function) => { callOrder.push('child'); done(null, p); });
      const parentSpy = vi.fn((p: any, done: Function) => { callOrder.push('parent'); done(null, p); });
      const getUpgradesScript = (name: string) => {
        if (name === 'H5P.Child') return { 1: { 1: childSpy } };
        if (name === 'H5P.Parent') return { 1: { 1: parentSpy } };
        return {};
      };

      upgradeContent(field, getUpgradesScript, () => ({ major: 1, minor: 1 }));

      expect(callOrder[0]).toBe('child');
      expect(callOrder[1]).toBe('parent');
    });

    it('updates the library version string to the latest version', () => {
      const field = makeLibraryField('H5P.Blanks', 1, 13, {});
      const upgrades = { 1: { 14: (p: any, done: Function) => done(null, p) } };
      const getLatest = makeGetLatest({ 'H5P.Blanks': { major: 1, minor: 14 } });

      const result = upgradeContent(field, () => upgrades, getLatest);

      expect(result.library).toBe('H5P.Blanks 1.14');
    });

    it('recurses into all keys of a non-library object and upgrades nested library fields', () => {
      const params = {
        nested: { library: 'H5P.Child 1.0', params: { val: 'x' } },
        unrelated: 'text',
      };
      const upgrades = { 1: { 1: (p: any, done: Function) => done(null, { ...p, upgraded: true }) } };
      const getLatest = makeGetLatest({ 'H5P.Child': { major: 1, minor: 1 } });

      const result = upgradeContent(params, () => upgrades, getLatest);

      expect(result.nested.params.upgraded).toBe(true);
      expect(result.unrelated).toBe('text');
    });

    it('processes library fields nested inside an array', () => {
      const params = {
        items: [
          { library: 'H5P.Child 1.0', params: { val: 'x' } },
        ],
      };
      const upgrades = { 1: { 1: (p: any, done: Function) => done(null, { ...p, upgraded: true }) } };
      const getLatest = makeGetLatest({ 'H5P.Child': { major: 1, minor: 1 } });

      const result = upgradeContent(params, () => upgrades, getLatest);

      expect(result.items[0].params.upgraded).toBe(true);
    });

    it('leaves primitive leaf values unchanged', () => {
      const params = { title: 'Hello', count: 42, active: true };

      const result = upgradeContent(params, () => ({}), () => ({ major: 1, minor: 0 }));

      expect(result).toEqual({ title: 'Hello', count: 42, active: true });
    });
  });
});
