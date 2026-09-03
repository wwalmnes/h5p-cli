# Changelog

All notable changes to h5p-cli are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.0.0]

h5p-cli 2.0 is a rewrite. The tool is written in TypeScript, ships as an ESM package that Node runs
directly with no build step, parses its command line with [Commander](https://github.com/tj/commander.js),
and is organised into a layered architecture (Command → Service → Adapter → Logic) that is covered by
tests and extensible through plugins. Output goes through a single UI layer, failures set an exit code,
and every command is documented.

Most command names and arguments are unchanged. The changes that will affect an existing workflow are
the Node version, the git subcommands moving to `h5p git`, and the working-directory rules now being
enforced instead of silently producing empty results.

### Breaking changes

- **Node v24 or newer is required** (`engines: { node: ">=24" }`). The CLI runs its TypeScript sources
  directly using Node's native type stripping.
- **No build step, anywhere.** There is no `dist/`, no bundler and no `build` script — the package
  `exports` point straight at `.ts` sources. This applies to plugins too.
- **The package is now ESM** (`"type": "module"`). Code that did `require('h5p-cli/logic')` must switch
  to `import`.
- **Git subcommands moved from `h5p utils` to `h5p git`.** `checkout`, `new-branch`, `rm-branch`,
  `merge`, `status`, `diff`, `commit`, `pull`, `push` and `tag` are now `h5p git <command>`. `h5p utils`
  keeps the repo, versioning, translation, packaging and consistency commands.
- **Working directory is enforced.** Top-level commands (`export`, `install`, `setup`, `deps`, …) must
  run from the workspace root — the folder holding `libraries/`, `content/` and `temp/`. `h5p git` and
  `h5p utils` run from *inside* `libraries/`. Both groups previously read bare relative paths, so a wrong
  directory produced an empty result; now it stops with a message telling you where to go. `h5p core`
  and `h5p plugin` work from anywhere.
- **Failing commands exit non-zero.** A command that reported an error still exited 0 before, so
  `h5p install X && next` ran `next` after a failed install. Failures now set exit code 1.
- **`h5p utils list-deps` and `h5p utils recursive-minor-bump` were removed**, replaced by
  `h5p utils dependency-check` (report) and `h5p utils dependency-check --apply` (write).
- **Internal file layout moved.** `cli.js`, `logic.js`, `config.js`, `configLoader.js`, `server.js`,
  `api.js` and everything under `assets/utils/` are gone; source now lives under `src/` plus `logic.ts`,
  `logic-content-upgrade.ts` and `configLoader.ts` in the repo root. Only relevant if you imported
  h5p-cli internals by file path — use the `exports` map instead:

  | Import path | What it provides |
  |-------------|------------------|
  | `h5p-cli` | The CLI program |
  | `h5p-cli/logic` | Core logic layer (library parsing, registry, content operations) |
  | `h5p-cli/config` | Configuration loader (paths, settings) |
  | `h5p-cli/utils` | Utility helpers (`fromTemplate`, `parseGitUrl`, …) |
  | `h5p-cli/compute-dependencies` | Dependency resolution helpers |
  | `h5p-cli/plugin-types` | `H5PPlugin` and `AdapterOverrides` types |
  | `h5p-cli/ui` | Output helpers — messages, tables, progress, verbosity |
  | `h5p-cli/content-upgrade` | `upgradeContent`, for content parameter upgrades |

### Added

- **Plugin system.** `h5p plugin install <source>`, `h5p plugin list` and `h5p plugin uninstall <name>`
  install plugins from a local path or a GitHub URL (https or ssh). A plugin is a Node module that
  default-exports an `H5PPlugin` and can add commands, override built-in adapters, or both. Installed
  plugins are recorded in `h5p.plugins.json` and loaded on every invocation. Plugins can be written in
  TypeScript or ESM JavaScript — no build step either way. See `docs/plugins.md`.
- **Adapter overrides.** Adapters are the I/O boundary (file access, git, HTTP). Twelve built-in adapters
  can be replaced: `export`, `import`, `list`, `tags`, `deps`, `missing`, `install`, `verify`, `register`,
  `create`, `core`, `setup`. A plugin can replace one as the new default, or register it under a custom
  name that users opt into per run with `--adapter <name>`, e.g. `h5p export MyLibrary --adapter s3-export`.
- **`h5p create <name>`** — scaffolds a new H5P content type into `libraries/`.
- **`h5p git`** — the git sweep commands as their own group, with their own reference (`docs/commands-git.md`).
- **`h5p utils dependency-check <libraries...>`** — walks the *reverse* dependency graph to show which
  libraries need a minor bump when you bump one, and in what order. Follows both `semantics.json`
  `options` and `library.json` dependency entries, skips references pinned to another major, bumps each
  library once, reports cycles, and orders results dependencies-first. `--apply` rewrites `library.json`
  and `semantics.json` as text, so key order, indentation and blank lines survive — the diff is only the
  numbers that changed.
- **Consistent output layer.** All output goes through `ui`:
  - `--verbose` / `--quiet` global flags, plus `H5P_VERBOSE`, `H5P_DEBUG` and `H5P_QUIET`.
  - Results go to **stdout**, progress and status to **stderr**, so `h5p list > libraries.txt` captures
    only the rows.
  - Tables are boxed and squeezed to the terminal width when attached to a TTY, and degrade to bare
    aligned columns when piped, so scripts have nothing to strip.
  - Live progress rendering for multi-repo sweeps; colour honours `NO_COLOR` and `FORCE_COLOR`.
  - Error stacks are hidden by default and shown under `--verbose`.
- **Proper help and version output.** `--help` / `-h` on every command and subcommand, and `--version`.
  `h5p help [command]` still works.
- **Input validation.** Command arguments are validated with [zod](https://zod.dev) at the CLI boundary,
  so bad input produces a clear message instead of a stack trace from deep inside the tool.
- **Documentation**, linked from a table in the readme:
  - `docs/commands.md` — every top-level `h5p` command
  - `docs/commands-git.md` — the `h5p git` group
  - `docs/commands-utils.md` — the `h5p utils` group
  - `docs/plugins.md` — plugin API: commands, adapters, interfaces, installation
  - `docs/workspace-plugins.md` — developing plugins with npm workspaces
- **Test suite.** 55 test files across commands, services, lib, logic, integration and end-to-end layers,
  plus a Playwright smoke test that boots the dev server. `npm test`, `test:unit`, `test:integration`,
  `test:logic`, `test:e2e`, `test:watch`, `test:smoke`, and `npm run typecheck`.
- **A bundled `libraryRegistry.json`**, and a `files` allowlist in `package.json` so the published
  package ships sources, assets and docs only.

### Changed

- Rewritten in TypeScript with `strict` mode enabled; `npm run typecheck` covers the whole tree.
- Command line parsing moved from a hand-rolled argv switch to Commander v14.
- Architecture split into **Command → Service → Adapter → Logic**: commands own the CLI contract,
  services own the flow, adapters own I/O. This is what makes both the tests and the plugin adapter
  overrides possible.
- The monolithic `logic.js` (752 lines, mixed responsibilities) was split into a slimmer `logic.ts` plus
  focused modules under `src/lib/` (`compute-dependencies`, `h5p-utils`, `semantics-utils`,
  `archive-utils`, `process-repos`, `workspace`, `ui`) and `src/services/` (`translation-service`,
  `versioning-service`, `dependency-analysis-service`, and others).
- `h5p git` and `h5p utils` subcommands were split out of a few large files into one module per
  subcommand under `src/commands/git/` and `src/commands/utils/`.
- `.gitignore` now covers `plugins/`, `h5p.plugins.json`, `playwright-report/` and `test-results/`.

### Compatibility

Everything except the git subcommands keeps its name and positional arguments: `setup`, `core`,
`server`, `list`, `tags`, `register`, `deps`, `missing`, `clone`, `install`, `verify`,
`branches` / `@branches`, `export`, `import`, `help` and the remaining `utils` subcommands. The
`H5P_NO_UPDATES` and `H5P_SSH_CLONE` environment variables behave as before, and `config.js` in the
workspace root still overrides folder names.
