/**
 * Resolves the bare names a user types into libraries and language codes.
 *
 * This is the one genuinely useful half of the old `utils/utility/input.ts`:
 * a name is a *library* because a folder by that name exists next to it, and
 * anything left over is taken to be a language code. Commander cannot decide
 * that — it never looks at the filesystem — which is why the split lives here
 * rather than in a `.argument()`.
 *
 * Kept pure: the caller supplies the directory listing, the same way
 * `renderTable`/`renderRows` in `ui.ts` take their inputs, so this is testable
 * without touching disk. Callers pass `findRepos()` when a name must be a git
 * checkout, or `fs.readdirSync('.')` when any folder will do.
 */

export type LibrarySplit = {
  libraries: string[];
  languages: string[];
};

/** Strip the trailing '/' that shell tab-completion appends to a folder name. */
export function stripTrailingSlash(name: string): string {
  return name.endsWith('/') ? name.slice(0, -1) : name;
}

/**
 * `'*'` expands to every directory; otherwise a name is a library when it
 * matches one. Unmatched names become languages — they are not validated
 * against a code list, because the caller that wants them (check-translations)
 * hands them straight to the translation layer, which does its own lookup.
 */
export function splitLibrariesAndLanguages(names: string[], dirs: string[]): LibrarySplit {
  const cleaned = names.map(stripTrailingSlash);

  if (cleaned.includes('*')) {
    return {
      libraries: [...dirs],
      languages: cleaned.filter(name => name !== '*' && !dirs.includes(name))
    };
  }

  return {
    libraries: cleaned.filter(name => dirs.includes(name)),
    languages: cleaned.filter(name => !dirs.includes(name))
  };
}
