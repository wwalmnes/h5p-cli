# h5p CLI Commands

Quick reference for all `h5p` commands. Run `h5p help` in the terminal to print this list, or `h5p help <command>` for a specific entry.
You can also do `h5p <command> --help` for the same information.

---

## `h5p core`

Install the core H5P libraries required to view and edit content types.

```
h5p core
```

No arguments.

---

## `h5p setup`

Full one-command setup: registers the library and installs it along with all dependencies.

```
h5p setup <library|repoUrl> [version] [download]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library\|repoUrl` | Yes | Library machine name (e.g. `H5P.Accordion`) or a GitHub repo URL (e.g. `git@github.com:h5p/h5p-accordion.git`). Passing a URL also updates the local registry entry. |
| `version` | No | Specific version tag to install. Defaults to `master`. Use `h5p tags` to list available versions. |
| `download` | No | Pass `1` to download libraries instead of cloning them as git repos. |

**Environment variables**

| Variable | Effect |
|----------|--------|
| `H5P_NO_UPDATES=1` | Skip updating existing libraries (faster). |
| `H5P_SSH_CLONE=1` | Use SSH URLs when cloning (useful for private repos or committing from `libraries/<library>`). |

> [!IMPORTANT]
> If no `[version]` is specified, master branches are used.

**Example**

```bash
h5p setup git@github.com:h5p/h5p-accordion.git
h5p setup H5P.Accordion 1.0.0
h5p setup H5P.Accordion master 1   # download instead of clone
```

---

## `h5p server`

Start the development server.

```
h5p server [port]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `port` | No | Port number. Defaults to `8080`. |

Once running, open the URL in a browser to view, edit, create, import, export, and delete content types.

> To disable auto-reload on library file changes, set `files.watch` to `false` in `config.json`.

---

## `h5p list`

List H5P libraries from the local registry.

```
h5p list [machineName] [pullRegistry]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `machineName` | No | Pass `1` to display machine names instead of repo names. |
| `pullRegistry` | No | Pass `1` to recreate the local registry before listing. |

Output format: `<library> (<org>)`

---

## `h5p tags`

List available version tags for a library.

```
h5p tags <org> <library> <mainBranch>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `org` | Yes | GitHub organization (shown in `h5p list` output). |
| `library` | Yes | Repository name (e.g. `h5p-accordion`). |
| `mainBranch` | Yes | Main branch of the repository. Defaults to `master`. |

---

## `h5p register`

Add or update an entry in the local library registry.

```
h5p register <gitUrl|entry.json>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `gitUrl\|entry.json` | Yes | A GitHub URL (SSH or HTTPS) **or** a path to a JSON file with a full registry entry. |

**Accepted URL formats**

```
git@github.com:h5p/h5p-accordion.git
https://github.com/h5p/h5p-accordion
```

**`entry.json` format**

```json
{
  "H5P.Accordion": {
    "id": "H5P.Accordion",
    "title": "Accordion",
    "repo": {
      "type": "github",
      "url": "https://github.com/h5p/h5p-accordion"
    },
    "author": "Batman",
    "runnable": true,
    "shortName": "h5p-accordion",
    "repoName": "h5p-accordion",
    "org": "h5p"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Library machine name |
| `title` | Yes | Human-readable title |
| `repo` | No | Repository info |
| `author` | Yes | Author name |
| `runnable` | Yes | `true` if this is a top-level content type; `false` if it's a dependency |
| `shortName` | Yes | Library folder name |
| `repoName` | No | GitHub repository name |
| `org` | No | GitHub organization — required for `clone`, `install`, and `deps` commands |

---

## `h5p deps`

Compute the dependency tree for a library.

```
h5p deps <library> [mode] [version] [folder]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | Yes | Library machine name. |
| `mode` | No | `view` or `edit`. |
| `version` | No | Version tag. Defaults to `master`. |
| `folder` | No | Resolve deps from `libraries/<folder>` on disk instead of the registry. |

---

## `h5p missing`

Find dependencies that are not yet in the local registry.

```
h5p missing <library>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | Yes | Library machine name. The library itself must already exist in the local registry. |

---

## `h5p clone`

Clone a library and its dependencies as git repositories into the `libraries/` folder.

```
h5p clone <library> <mode>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | Yes | Library machine name. |
| `mode` | Yes | `view` or `edit`. |

---

## `h5p install`

Download (non-git) a library and its dependencies into the `libraries/` folder.

```
h5p install <library> <mode>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | Yes | Library machine name. |
| `mode` | Yes | `view` or `edit`. |

---

## `h5p verify`

Check whether a library is correctly set up (registry entry present, dependencies installed).

```
h5p verify <h5p-repo-name>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `h5p-repo-name` | Yes | Repository name (e.g. `h5p-accordion`). |

**Example output**

```js
{
  registry: true,        // library found in registry
  libraries: {           // dependency presence (optional deps ignored but should be present)
    'FontAwesome-4.5':      { optional: false, present: true },
    'H5P.AdvancedText-1.1': { optional: true,  present: true },
    'H5P.Accordion-1.0':    { optional: false, present: true }
  },
  ok: true               // overall setup status
}
```

---

## `h5p branches` / `h5p @branches`

Create `@<branch>` folders from other git branches of the current library. Must be run inside a git repository folder.

```
h5p branches <branch...>
h5p @branches <branch...>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `branch...` | Yes | One or more branch names. Each becomes an `@<branch>` folder. |

- Runs `npm install --ignore-scripts` and `npm run build` inside each `@<branch>` folder if a `build` script is present.
- Updates the `preloadedJs` and `preloadedCss` entries in `library.json` to include assets from each `@<branch>` folder.

---

## `h5p export`

Export a content type from the `content/` folder as a `.h5p` archive.

```
h5p export <library> <folder>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `library` | Yes | Library machine name (e.g. `h5p-agamotto`). |
| `folder` | Yes | Content folder name inside `content/` (e.g. `agamotto-test`). |

Make sure the library's dependencies are installed before exporting. The command prints the path to the resulting `.h5p` file.

**Example**

```bash
h5p export h5p-agamotto agamotto-test
```

---

## `h5p import`

Import a `.h5p` archive into the `content/` folder.

```
h5p import <folder> <h5p_archive_file_path>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `folder` | Yes | Destination folder name inside `content/`. |
| `h5p_archive_file_path` | Yes | Path to the `.h5p` archive file. |

The command prints the path to the resulting content folder.

**Example**

```bash
h5p import agamotto-test ~/Downloads/agamotto_test.h5p
```

---

## `h5p help`

Print the help page or a help entry for a specific command.

```
h5p help [command]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `command` | No | Command name. Omit to print the full help page. |

For utility subcommands:

```bash
h5p utils help           # list all utils subcommands
h5p utils help <cmd>     # detailed help for a specific utils subcommand
```

---

## `h5p utils`

Utility commands for multi-repo git workflows, versioning, translations, packaging, and validation.

```
h5p utils <subcommand> [args]
```

See [commands-utils.md](./commands-utils.md) for the full reference.

For quick help in the terminal:

```bash
h5p utils help           # list all utils subcommands
h5p utils help <cmd>     # detailed help for a specific subcommand
```
