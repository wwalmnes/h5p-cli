import { describe, it, expect } from 'vitest';
import {
  splitLibrariesAndLanguages,
  stripTrailingSlash,
} from '../../src/lib/resolve-libraries.ts';

const DIRS = ['h5p-accordion', 'h5p-blanks', 'h5p-course-presentation'];

describe('stripTrailingSlash', () => {
  it('removes the slash shell completion appends', () => {
    expect(stripTrailingSlash('h5p-accordion/')).toBe('h5p-accordion');
  });

  it('leaves a bare name alone', () => {
    expect(stripTrailingSlash('h5p-accordion')).toBe('h5p-accordion');
  });

  it('does not mangle an empty string', () => {
    expect(stripTrailingSlash('')).toBe('');
  });
});

describe('splitLibrariesAndLanguages', () => {
  it('treats a name matching a folder as a library', () => {
    expect(splitLibrariesAndLanguages(['h5p-accordion'], DIRS)).toEqual({
      libraries: ['h5p-accordion'],
      languages: [],
    });
  });

  it('treats an unmatched name as a language code', () => {
    expect(splitLibrariesAndLanguages(['nb'], DIRS)).toEqual({
      libraries: [],
      languages: ['nb'],
    });
  });

  it('separates the two regardless of the order they were typed', () => {
    const languageFirst = splitLibrariesAndLanguages(['nb', 'h5p-accordion'], DIRS);
    const libraryFirst = splitLibrariesAndLanguages(['h5p-accordion', 'nb'], DIRS);

    expect(languageFirst).toEqual({ libraries: ['h5p-accordion'], languages: ['nb'] });
    expect(libraryFirst).toEqual(languageFirst);
  });

  it('strips trailing slashes before matching', () => {
    expect(splitLibrariesAndLanguages(['h5p-accordion/'], DIRS).libraries).toEqual([
      'h5p-accordion',
    ]);
  });

  it("expands '*' to every directory", () => {
    expect(splitLibrariesAndLanguages(['*'], DIRS)).toEqual({
      libraries: DIRS,
      languages: [],
    });
  });

  it("keeps languages given alongside '*'", () => {
    expect(splitLibrariesAndLanguages(['*', 'nb'], DIRS)).toEqual({
      libraries: DIRS,
      languages: ['nb'],
    });
  });

  it('returns empty lists for no input', () => {
    expect(splitLibrariesAndLanguages([], DIRS)).toEqual({ libraries: [], languages: [] });
  });

  it('treats every name as a language when no directories exist', () => {
    expect(splitLibrariesAndLanguages(['h5p-accordion', 'nb'], [])).toEqual({
      libraries: [],
      languages: ['h5p-accordion', 'nb'],
    });
  });

  it('does not duplicate a library that is also named alongside the wildcard', () => {
    const result = splitLibrariesAndLanguages(['*', 'h5p-accordion'], DIRS);

    expect(result.libraries).toEqual(DIRS);
    expect(result.languages).toEqual([]);
  });
});
