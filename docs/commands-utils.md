# h5p utils Commands

Quick reference for all `h5p utils` subcommands. Run `h5p utils --help` to print this list.

Multi-repo git operations live under [`h5p git`](./commands-git.md).

## Working directory

**Run these commands from inside `libraries/`**, where each library is a direct subfolder:

```bash
cd libraries
h5p utils get H5P.Accordion
h5p utils validate h5p-accordion
```

A library argument names a subfolder of the current directory — `<name>`, not
`libraries/<name>`. This is the opposite of the top-level
[`h5p` commands](./commands.md), which run from the workspace root. If no git repository is
found in the current folder, the command stops with a message instead of quietly doing
nothing.

Exceptions: `list` and `help` touch no files and work from anywhere; `get` and `init`
*create* the checkouts, so they run in an empty folder too. `dependency-check` takes an
explicit `--libraries <path>` (also settable via `H5P_LIBRARIES`) if you need to point it
somewhere other than the current folder.

---

## Version Control

---

## `h5p utils tag-version`

Create a tag from the current version number in `library.json` for the given or all libraries.

```
h5p utils tag-version [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## Repository Operations

---

## `h5p utils get`

Clone a library and all its dependencies into the **current** folder — run it from inside `libraries/`.

```
h5p utils get [options] <libraries...>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | Yes | Library names to clone. |

| Option | Description |
|--------|-------------|
| `--https` | Use HTTPS URLs instead of SSH for cloning. |

---

## `h5p utils list`

List all H5P libraries available in the local registry.

```
h5p utils list
```

No arguments.

---

## `h5p utils init`

Initialize a new H5P library scaffold in a subfolder of the current directory.

```
h5p utils init <library>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | Yes | Library name. Also the folder it is created in. |

Prompts for title, description, entry point, author and license.

---

## Version Bumping

---

## `h5p utils increase-patch-version`

Increase the patch version in `library.json` for the given or all libraries.

```
h5p utils increase-patch-version [options] [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to apply to all libraries. |

| Option | Description |
|--------|-------------|
| `-f` | Force increase even if there are no new changes. |

---

## `h5p utils recursive-minor-bump`

Removed. Use [`h5p utils dependency-check --apply`](#h5p-utils-dependency-check), which
does the same job with a proper dependency graph.

---

## `h5p utils bump`

Bump the patch version of a library, then commit, tag and push it.

```
h5p utils bump [options] <library>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | Yes | Library folder inside the current directory. |

| Option | Description |
|--------|-------------|
| `-y, --yes` | Skip all interactive prompts and accept defaults. |

---

## Change Tracking

---

## `h5p utils changes-since`

Show files changed since the last N versions for the given or all libraries.

```
h5p utils changes-since [numVersions] [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `numVersions` | No | Number of versions to look back. Defaults to `1`. If not a number, treated as a library name. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p utils changes-since-release`

Show files changed since the last release for the given or all libraries.

```
h5p utils changes-since-release [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p utils commits-since`

Show commits since the last N versions for the given or all libraries.

```
h5p utils commits-since [numVersions] [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `numVersions` | No | Number of versions to look back. Defaults to `1`. If not a number, treated as a library name. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p utils compare-tags-with-release`

Compare the tag of the release branch with the master branch for the given or all libraries.

```
h5p utils compare-tags-with-release [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## Translation Management

---

## `h5p utils create-language-file`

Create a new language file for a library.

```
h5p utils create-language-file <library> <languageCode>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | Yes | Library name. |
| `languageCode` | Yes | BCP 47 language code (e.g. `nb`, `de`, `fr`). |

---

## `h5p utils import-language-files`

Import language files from a directory into the matching libraries.

```
h5p utils import-language-files <dir>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `dir` | Yes | Path to the source directory containing language files. |

---

## `h5p utils add-english-texts`

Add English text strings to a translation file for the given libraries.

```
h5p utils add-english-texts [options] <languageCode> <libraries...>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `languageCode` | Yes | Target language code. |
| `libraries...` | Yes | One or more library names. |

| Option | Description |
|--------|-------------|
| `-P` | Populate new strings with English text instead of `TODO` placeholders. |

---

## `h5p utils copy-translation`

Use one language file as a template to create another language file.

```
h5p utils copy-translation <from> <to> <libraries...>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `from` | Yes | Source language code. |
| `to` | Yes | Target language code. |
| `libraries...` | Yes | One or more library names. |

---

## `h5p utils pack-translation`

Export translation files for the given libraries as a zip archive.

```
h5p utils pack-translation <languageCode> <libraries...> [output.zip]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `languageCode` | Yes | Language code to export. |
| `libraries...` | Yes | One or more library names. |
| `output.zip` | No | Output zip filename. Defaults to `translations.zip`. Detected by `.zip` extension in the argument list. |

---

## `h5p utils update-translations`

Update all translation files for the given libraries.

```
h5p utils update-translations <libraries...>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | Yes | One or more library names. |

---

## `h5p utils check-translations`

Check that translation files match the `nb` (Norwegian Bokmål) language file.

```
h5p utils check-translations [options] [language] [library]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `language` | No | Language code to check. |
| `library` | No | Library name. |

| Option | Description |
|--------|-------------|
| `-diff` | Show differences between translations. |

Exits with code `0` on success, `1` on failure.

---

## Packaging & Validation

---

## `h5p utils pack`

Pack one or more libraries into a `.h5p` archive.

```
h5p utils pack [options] <libraries...> [output.h5p]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | Yes | One or more library names. The last argument is used as the output filename if it ends with `.h5p`. |
| `output.h5p` | No | Output filename. Detected by `.h5p` extension in the argument list. |

| Option | Description |
|--------|-------------|
| `-r` | Recursive: include dependencies. |
| `-f` | Skip library validation before packing. |

---

## `h5p utils validate`

Validate one or more H5P libraries.

```
h5p utils validate <libraries...>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | Yes | One or more library names. |

Exits with code `0` if all libraries are valid, `1` if any are invalid.

---

## `h5p utils build`

Install dependencies, build, and optionally test the given libraries.

```
h5p utils build [options] <libraries...>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | Yes | One or more library names. |

| Option | Description |
|--------|-------------|
| `-t` | Run tests after building. |

---

## Dependency & Consistency

---

## `h5p utils dependency-check`

Work out which libraries need a minor bump when you bump one or more libraries, and in
what order — then optionally write the bumps and the reference updates.

Replaces the old `list-deps` (report) and `recursive-minor-bump` (write) commands.

```
h5p utils dependency-check <libraries...> [--libraries <path>] [--apply]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | Yes | One or more libraries being bumped. Accepts a machine name (`H5P.Accordion`), a checkout folder name (`h5p-accordion`), or either with an explicit version range (`H5P.Accordion@1.0..1.2`). |

| Option | Description |
|--------|-------------|
| `--libraries <path>` | Folder of library checkouts to analyse. Defaults to `$H5P_LIBRARIES`, or the current directory. |
| `--apply` | Write the changes. Without it the command only reports. |

### What it does

Bumping a library strands everyone who pins its old version. This command walks the
*reverse* dependency graph from the libraries you name and reports the full ripple:

- Both kinds of reference are followed — `options` entries in `semantics.json` and
  entries in `preloadedDependencies` / `editorDependencies` / `dynamicDependencies` in
  `library.json`. Fixing either one is itself a minor bump, so the ripple continues.
- References pinned to a **different major version** are left alone.
- Each library is bumped **once**, no matter how many paths reach it, and once only
  even when several libraries are named in one run.
- Results are ordered dependencies-first, so you can work straight down the list.
  Mutually-referencing libraries (Column ↔ Row) are reported as a cycle and should be
  bumped and updated in one commit.
- References that already point at the new version are reported as up to date and not
  touched.

`--apply` writes `library.json` and `semantics.json` as text, so key order, indentation
and blank lines survive — the diff is only the numbers that changed. `patchVersion` is
reset to 0 on every bump.

Note that `H5P_IGNORE_REPOS` / `H5P_SEMI_IGNORE_REPOS` do **not** apply here: the ripple
is only correct if every referring library is visible.

### Examples

```bash
# what breaks if I bump Accordion?
h5p utils dependency-check H5P.Accordion

# the chains and the exact file:line edits
h5p --verbose utils dependency-check H5P.Accordion

# several libraries at once, one of them to an explicit version
h5p utils dependency-check H5P.Accordion H5P.Column@1.22..1.25

# do it
h5p utils dependency-check H5P.Accordion --apply
```

---

## `h5p utils find-inconsistencies`

Find version inconsistencies across all libraries in the `libraries/` folder.

```
h5p utils find-inconsistencies
```

No arguments.

---

## Help

---

## `h5p utils help`

Display help for utils commands.

```
h5p utils help [command]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `command` | No | Subcommand name. Omit to list all utils subcommands. |

For detailed option help on any subcommand, use the `--help` flag directly:

```bash
h5p utils <subcommand> --help
```
