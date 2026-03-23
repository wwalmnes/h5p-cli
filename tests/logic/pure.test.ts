import { describe, it, expect } from 'vitest';
import { machineToShort, parseGitUrl, fromTemplate } from '../../src/lib/h5p-utils';

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
});

describe('fromTemplate', () => {
  it('substitutes a single key', () => {
    expect(fromTemplate('{org}/{repo}', { org: 'h5p', repo: 'h5p-blanks' })).toBe('h5p/h5p-blanks');
  });

  it('replaces all occurrences of the same key', () => {
    expect(fromTemplate('{org}/{org}', { org: 'h5p' })).toBe('h5p/h5p');
  });
});
