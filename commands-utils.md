# h5p utils Commands

Quick reference for all `h5p utils` subcommands. Run `h5p utils help` or `h5p utils --help` to print this list.

---

## Git / Version Control

---

## `h5p utils checkout`

Change branch for the given or all libraries.

```
h5p utils checkout <branch> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | Yes | Branch name to check out. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p utils new-branch`

Create a new branch (local and remote) for the given or all libraries.

```
h5p utils new-branch <branch> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | Yes | Branch name. Must not start with `h5p-`. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p utils rm-branch`

Remove a branch (local and remote) for the given or all libraries.

```
h5p utils rm-branch <branch> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | Yes | Branch name. Must not start with `h5p-` and must not be `master`. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p utils diff`

Print the combined diff for all repos.

```
h5p utils diff
```

No arguments.

---

## `h5p utils merge`

Merge a branch into the given or all libraries.

```
h5p utils merge <branch> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | Yes | Branch name to merge in. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p utils tag`

Create a tag for the given or all libraries.

```
h5p utils tag <tagName> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `tagName` | Yes | Tag name. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

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

## `h5p utils status`

Show git status for the given or all libraries.

```
h5p utils status [options] [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to show all libraries. |

| Option | Description |
|--------|-------------|
| `-f` | Display which branch each library is on. |

---

## `h5p utils pull`

Pull the given or all repos.

```
h5p utils pull [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to pull all repos. |

---

## `h5p utils push`

Push the given or all repos.

```
h5p utils push [options] [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to push all repos. |

| Option | Description |
|--------|-------------|
| `--tags` | Push tags in addition to commits. |

---

## `h5p utils commit`

Commit staged changes to the given or all repos with a message.

```
h5p utils commit <message> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `message` | Yes | Commit message. Must be at least two words. |
| `libraries...` | No | Library names. Omit to commit all repos. |

---

## Repository Operations

---

## `h5p utils get`

Clone a library and all its dependencies into the `libraries/` folder.

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

Initialize a new H5P library scaffold in the current directory.

```
h5p utils init <library>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | Yes | Library name. |

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

Bump the minor version recursively for the specified libraries and their dependants.

```
h5p utils recursive-minor-bump <libraries...>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | Yes | One or more library names. |

---

## `h5p utils bump`

Interactively bump the version of a library.

```
h5p utils bump [options] [library]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | No | Library name. Defaults to the library in the current directory. |

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

## `h5p utils list-deps`

List all libraries that have a dependency on the given library or libraries.

```
h5p utils list-deps <libraries...>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | Yes | One or more library names. |

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
