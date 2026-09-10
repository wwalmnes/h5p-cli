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
- **The package is now ESM** (`"type": "module"`). Code that did `require('h5p-cli/logic')` must switch
  to `import`. The package also gains an `exports` map, and every subpath in it resolves to a `.ts`
  source that Node runs as-is — there is nothing to build, in the CLI or in a plugin.
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
- `.gitignore` now also covers `plugins/`, `h5p.plugins.json`, `playwright-report/` and `test-results/`.
- **`h5p setup <library> [ref]` accepts a branch name, not just a release.** The second positional took
  a version and nothing else; it now takes any git ref. A release (`1.14` / `1.14.3`) resolves through
  the graph and clones everyone at the resulting patch. A branch name clones only the library at that
  ref; its dependencies are read from that ref's `library.json` and cloned at their declared versions,
  falling back to `master` if a tag is missing. Branch metadata is not written to the on-disk cache
  (a branch moves).
- **`h5p setup` resolves its dependency graph once instead of once per dependency.** It used to run
  about N+4 traversals of the same graph — 16 for `h5p-blanks`, 73 for `h5p-interactive-book`. A single
  `edit` resolution covers all of them, because the mode is applied at every node and view edges are a
  subset of edit edges. The installed set is unchanged. `logic.installDependencies` was split out of
  `logic.getWithDependencies` so a resolved graph can be installed without being resolved again;
  `getWithDependencies` remains as the one-shot pairing of the two.
- **Dependency installs run through a bounded pool** rather than one library at a time in a serial
  loop. `logic.installDependencies` hands its work to `runPool` (`src/lib/pool.ts`), four at a time by
  default, set with `-c, --concurrency <n>` on `h5p setup` or `H5P_CONCURRENCY`. Every library is
  reserved before any task starts, because the skip list is the only guard against installing one
  twice; a consequence is that a required unregistered library now aborts *before* anything installs,
  where the serial loop threw midway. On failure the pool stops scheduling and kills the children still
  running, so the CLI exits when it reports the error rather than after the surviving builds drain.
- **The resolver fetches each dependency wave in parallel** rather than one library at a time. On
  `h5p-interactive-book` (95 libraries) that takes the resolve from ~2N round trips to roughly one per
  wave.
- **`h5p missing` resolves its dependency graph once instead of once per dependency.** It ran the same
  N+2 traversals `h5p setup` did — the view graph, an edit graph rooted at every registered library in
  it, then the root's edit graph — 71 of them for `h5p-column`. Because it resolves against the
  installed folders, each traversal re-read every `library.json` and `semantics.json` from disk and
  re-scanned the whole `libraries/` folder, so `h5p missing h5p-column` went from 10.1s to 0.8s. The
  reported libraries are unchanged.
- **`h5p tags` reads `git ls-remote`** instead of cloning the repository into `temp/`, unshallowing it,
  checking out and pulling. Dependency resolution calls it once per library whenever a version is given,
  so a versioned setup no longer clones the entire graph just to read version numbers.
- **`h5p core` fetches everything it installs at once, and resolves nothing.** It ran in two
  sequential phases: clone `h5p-php-library` and `h5p-editor-php-library` one after the other through
  `spawnSync` (which blocks the event loop, so the command printed a line per library and then froze),
  *then* resolve `h5p-math-display`'s dependency graph and install it. Nothing here has dependencies —
  the PHP core is not an H5P library at all, and MathDisplay declares no `preloadedDependencies`, no
  `editorDependencies` and ships no `semantics.json` — so the resolution made three HTTP round trips
  (the registry, then `library.json` and `semantics.json`) to learn a folder name and an empty
  dependency list, and, worse, kept MathDisplay from starting its clone until the PHP core had
  finished. All three now go through one `logic.installCore` pool: **13.9s → 8.2s** cold, bounded by
  MathDisplay's own `npm`+webpack build rather than the sum of the phases, and with no HTTP beyond the
  git clones themselves. They also gain the live progress area, the ten-minute command budget, the
  non-interactive subprocess env and kill-by-process-group on failure. `-c, --concurrency <n>` and
  `H5P_CONCURRENCY` now apply to `h5p core`. Note that running clones concurrently is not by itself
  faster when bandwidth is the bottleneck — the two PHP repos alone measured 5.0–5.8s serial against
  5.3–5.4s parallel, the same pipe split two ways; the win comes from overlapping them with the work
  that used to wait behind them.
- **`config.core.setup` entries are now `{ repo, machineName }`** rather than bare library names
  (breaking, if you override `core` in a workspace `config.js`). The machine name is what lets
  "is it already installed?" be a single `readdirSync` of `libraries/` instead of a registry lookup.
  The version half of the folder name is still read from the clone's own `library.json`, so an
  upstream `1.0` → `1.1` bump lands in the right folder with no config change.
- **`h5p core` refreshes core libraries that are already installed**, instead of skipping any folder
  that exists. It takes the same `_update` path as `h5p setup`: pull, rebuild if commits landed, and
  leave a library alone (with a message) when it has uncommitted changes or is on a branch other than
  `master`. `H5P_NO_UPDATES=1` skips it, as it does for setup.
- **A library's build installs with `npm ci`, not `npm install --ignore-scripts`.** `npm install`
  rewrites `package-lock.json`, and the update path added in this release refuses to pull anything with
  uncommitted changes — so building a library on install would leave that one tracked file dirty and
  the library unrefreshable from then on. For `h5p-math-display` the lockfile would be the *only* dirty
  file, its `dist/` being gitignored. `npm ci` installs from the lockfile and never writes it; it needs
  one that matches `package.json`, so there is a fallback to `npm install` for libraries with no
  lockfile or a drifted one.
- **Subprocesses are spawned non-interactively.** A prompt inside a subprocess is a permanent hang
  rather than a question: ssh and git write theirs to `/dev/tty`, which the live progress area repaints
  over, so the user sees a frozen row and never the prompt. Every command now runs with
  `GIT_TERMINAL_PROMPT=0` and `-o BatchMode=yes` composed onto any existing `GIT_SSH_COMMAND`, and with
  stdin at EOF. Git's credential helpers are untouched, so the osxkeychain path a private clone needs
  still works. The env is inherited, which is what reaches a nested clone two levels down inside a
  library's own `npm run build`.
- **Every command is time-bounded and killed by process group.** Ten minutes by default,
  `H5P_EXEC_TIMEOUT` in seconds; on expiry the command is killed and the failure names it and its
  working directory. Children are spawned `detached` and signalled as `-pid`, because commands run
  through a shell and the npm/webpack/ssh processes below it survive a kill aimed at the shell alone —
  keeping the inherited pipes open, so node could never exit.

### Fixed

- **`h5p setup <library> <version>` now works at all.** A `major.minor` version was passed through to the
  fetch verbatim, but that is not a ref — `h5p-blanks` publishes `1.1.5` and `1.1.1`, never `1.1` — so the
  command failed with `Remote branch 1.1 not found in upstream origin`. The root library's version now
  goes through the same patch lookup its dependencies always did.
- **`h5p setup <library>` with no version no longer replays a stale dependency graph.** Library metadata
  was read out of a `temp/<repo>_<branch>` checkout that was cloned the first time it was needed and
  never fetched forward, so a setup tracking `master` resolved the graph as it was on that first run —
  indefinitely, until you deleted `temp` by hand. Metadata is now fetched over HTTP instead of by
  cloning, memoised for the invocation, and written to disk **only for an immutable `x.y.z` tag**; a
  mutable ref is never cached across runs. The branch checkout is bypassed in favour of the raw host,
  and fetched forward where it is still the only transport (private repositories, `H5P_NO_RAW=1`). A
  warm `temp/` still resolves offline. The cost is that a `master` resolve re-reads two small files per
  library on every invocation — roughly 1–3s for a large content type, in parallel waves — where it
  previously read them from disk; `h5p deps` and `h5p missing` are where that is visible. Note that
  libraries mis-installed under a wrong `H5P.Name-major.minor` folder by the old stale graph are left
  alone, since removing anything from `libraries/` risks destroying work; delete those folders yourself
  if you have them.
- **Patch resolution no longer matches across minor versions.** Tags were compared with a bare prefix
  test, so version `1.1` also accepted `1.11.x`; for `h5p-blanks` that resolved `1.1` to the nonexistent
  tag `1.1.13`.
- **Downloaded release tags resolve.** The archive URL hardcoded `refs/heads/`, so every tagged download
  requested a branch of that name and 404'd, and the unpacked archive root was assumed to be
  `${repo}-master`, which is wrong for every ref that is not `master`; only `master` ever worked. The
  ref is now chosen per version and the archive root is read from disk. Each download also gets its own
  scratch directory rather than sharing one `temp/temp.zip`, which two downloads running at once would
  clobber.
- **A library whose declared version was never tagged no longer aborts the install.** `h5p clone` and
  `h5p install` fetch every library at the `major.minor.patch` its `library.json` declares, but H5P
  largely stopped tagging releases — `h5p-accordion` declares 1.0.47 and its newest tag is 1.0.33 — so
  the requested ref usually does not exist. Both commands failed on it, and `h5p install h5p-accordion`
  reported only superagent's bare `Not Found`, naming neither the library nor the URL. A missing ref is
  now reported and the library is fetched from `master` instead, over either transport: a failed clone
  over git and a 404 on the archive URL over http are the same condition. A root library pinned to an
  explicit branch is exempt, as that ref must exist. Download failures that are not a missing ref name
  the URL and the status.
- **`h5p setup` no longer disturbs a library you are working in.** It ran `git checkout master` and
  `git pull` over any installed library; git then refused to overwrite modified files and the failure
  aborted the whole setup. A library with uncommitted changes, or on a branch other than `master`, is now
  reported and left alone.
- **An updated library is rebuilt.** Pulling new commits left the previous build output in place, because
  only the fresh-install path ever ran the build.
- **A failed `h5p core` no longer poisons `libraries/`.** Its clones went through `logic.clone`, which
  took no part in the incomplete-folder tracking the dependency installs use, so a clone that failed
  or was interrupted left a half-written folder behind. `fs.existsSync(folder)` is the whole
  already-installed test, so every later `h5p core` reported that library as installed and skipped
  it — permanently, until the folder was deleted by hand. The core clones now claim their folder
  before they start and discard it on failure, like every other install. A library whose folder name
  is only known after cloning is staged under `temp/` and the claim moves with it, so an interrupt
  mid-rename cannot strand either copy.
- **`h5p missing` no longer reports an optional dependency as required.** Each per-dependency pass
  re-rooted the library it started from, and a root has no parent to inherit optionality from, so an
  unregistered library reachable only underneath an optional one was listed `(required)`. It is now
  listed `(optional)`.
- **`h5p missing <unknown>` reports the library instead of a stack trace.** A name the registry does not
  know produced `Cannot read properties of undefined (reading 'id')`; it now fails with
  `unregistered <name> library`.

### Compatibility

Everything except the git subcommands keeps its name and positional arguments: `setup`, `core`,
`server`, `list`, `tags`, `register`, `deps`, `missing`, `clone`, `install`, `verify`,
`branches` / `@branches`, `export`, `import`, `help` and the remaining `utils` subcommands. The
`H5P_NO_UPDATES` and `H5P_SSH_CLONE` environment variables behave as before, and `config.js` in the
workspace root still overrides folder names.
