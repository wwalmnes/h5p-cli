import { describe, it, expect } from 'vitest';
import {
  fromTemplate,
  parseGitUrl,
  machineToShort,
  pathHasDuplicates,
  parseSemanticLibraries,
} from '../../src/lib/h5p-utils';

describe('fromTemplate', () => {
  it('substitutes a single key', () => {
    expect(fromTemplate('{org}/{repo}', { org: 'h5p', repo: 'h5p-blanks' })).toBe('h5p/h5p-blanks');
  });

  it('replaces all occurrences of the same key', () => {
    expect(fromTemplate('{org}/{org}', { org: 'h5p' })).toBe('h5p/h5p');
  });

  it('leaves unmatched placeholders intact', () => {
    expect(fromTemplate('{org}/{repo}', { org: 'h5p' })).toBe('h5p/{repo}');
  });

  it('substitutes multiple different keys', () => {
    expect(fromTemplate('{a}-{b}-{c}', { a: 'x', b: 'y', c: 'z' })).toBe('x-y-z');
  });
});

describe('parseGitUrl', () => {
  it('parses https git URL', () => {
    expect(parseGitUrl('https://github.com/h5p/h5p-blanks.git')).toEqual({
      host: 'github.com',
      org: 'h5p',
      repoName: 'h5p-blanks',
    });
  });

  it('parses ssh git URL', () => {
    expect(parseGitUrl('git@github.com:h5p/h5p-blanks.git')).toEqual({
      host: 'github.com',
      org: 'h5p',
      repoName: 'h5p-blanks',
    });
  });

  it('returns undefined for unrecognized URL scheme', () => {
    expect(parseGitUrl('ftp://example.com/repo.git')).toBeUndefined();
  });
});

describe('machineToShort', () => {
  it("converts 'H5P.Blanks' to 'h5p-blanks'", () => {
    expect(machineToShort('H5P.Blanks')).toBe('h5p-blanks');
  });

  it("converts 'H5P.SimpleMultiChoice' to 'h5p-simple-multi-choice'", () => {
    expect(machineToShort('H5P.SimpleMultiChoice')).toBe('h5p-simple-multi-choice');
  });

  it("converts 'H5PEditor.Blanks' to 'h5p-editor-blanks'", () => {
    expect(machineToShort('H5PEditor.Blanks')).toBe('h5p-editor-blanks');
  });
});

describe('pathHasDuplicates', () => {
  it('returns true when a segment appears twice', () => {
    expect(pathHasDuplicates('/h5p-blanks/h5p-joubel-ui/h5p-blanks')).toBe(true);
  });

  it('returns false when all segments are unique', () => {
    expect(pathHasDuplicates('/h5p-blanks/h5p-joubel-ui')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(pathHasDuplicates('')).toBe(false);
  });

  it('returns false for single segment', () => {
    expect(pathHasDuplicates('h5p-blanks')).toBe(false);
  });
});

describe('parseSemanticLibraries', () => {
  it('returns empty object for non-array input', () => {
    expect(parseSemanticLibraries(null)).toEqual({});
    expect(parseSemanticLibraries({})).toEqual({});
    expect(parseSemanticLibraries('string')).toEqual({});
  });

  it('returns empty object for empty array', () => {
    expect(parseSemanticLibraries([])).toEqual({});
  });

  it('extracts library from top-level type=library entry', () => {
    const semantics = [
      { type: 'library', options: ['H5P.Video 1.3', 'H5P.Image 1.1'] },
    ];
    const result = parseSemanticLibraries(semantics);
    expect(result['H5P.Video']).toEqual({ name: 'H5P.Video', version: '1.3' });
    expect(result['H5P.Image']).toEqual({ name: 'H5P.Image', version: '1.1' });
  });

  it('extracts library from nested fields array', () => {
    const semantics = [
      {
        type: 'group',
        fields: [
          { type: 'library', options: ['H5P.Blanks 1.14'] },
        ],
      },
    ];
    const result = parseSemanticLibraries(semantics);
    expect(result['H5P.Blanks']).toEqual({ name: 'H5P.Blanks', version: '1.14' });
  });

  it('ignores entries with no library type', () => {
    const semantics = [{ type: 'text', label: 'Title' }];
    expect(parseSemanticLibraries(semantics)).toEqual({});
  });
});
