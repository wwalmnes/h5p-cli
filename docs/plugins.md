# Creating Plugins for h5p-cli

> **Developing in the workspace?** See [workspace-plugins.md](workspace-plugins.md) for how to create and link plugins using the npm workspaces setup.

Plugins extend h5p-cli by adding new commands or replacing built-in adapters (the layer that performs I/O operations like file access, git calls, and API requests).

## Plugin structure

A plugin is a Node.js module (a directory with a main entry point) that exports an `H5PPlugin` object:

```typescript
import { Command } from 'commander';

interface H5PPlugin {
  name: string;
  commands?(): Command[];
  adapters?(): Record<string, new () => unknown>;
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier for the plugin |
| `commands()` | No | Returns an array of Commander.js `Command` objects to add to the CLI |
| `adapters()` | No | Returns a map of adapter keys to constructor classes that replace built-in adapters |

## Minimal example

Plugins can be written in **TypeScript** or **plain JavaScript** (ESM). Both use the same imports.

### TypeScript

```typescript
import { Command } from 'commander';
import type { H5PPlugin } from 'h5p-cli/plugin-types';
import { ui } from 'h5p-cli/ui';

const plugin: H5PPlugin = {
  name: 'my-plugin',

  commands() {
    return [
      new Command('greet')
        .description('Say hello')
        .argument('[name]', 'Name to greet')
        .action((name) => {
          ui.data(`Hello, ${name ?? 'world'}!`);
        }),
    ];
  },
};

export default plugin;
```

### JavaScript

```javascript
import { Command } from 'commander';
import { ui } from 'h5p-cli/ui';

export default {
  name: 'my-plugin',

  commands() {
    return [
      new Command('greet')
        .description('Say hello')
        .argument('[name]', 'Name to greet')
        .action((name) => {
          ui.data(`Hello, ${name ?? 'world'}!`);
        }),
    ];
  },
};
```

Set `"main"` in your `package.json` to `index.ts` for TypeScript or `index.js` for JavaScript.

After installing, `h5p greet Alice` prints `Hello, Alice!`.

The greeting is what the command produces, so it goes out through `ui.data()` rather than `console.log`. See [Output and progress](#output-and-progress) for why that matters.

## Adding commands

The `commands()` method returns an array of Commander.js `Command` instances. Each command is registered at the top level of the CLI.

If a plugin command has the same name as a built-in command, **the plugin command replaces it**. This lets you override default behavior entirely.

```typescript
commands() {
  const cmd = new Command('list') // <-- overwriting list command
    .description('Custom list implementation')
    .action(async () => {
      // your custom logic
    });
  return [cmd];
}
```

## Output and progress

Plugins should print through `h5p-cli/ui` rather than `console.log`. It gives every plugin the same look as the built-in commands, and it is the only way your output participates in `--quiet` / `--verbose` and the live progress area.

```typescript
import { ui } from 'h5p-cli/ui';
```

### Two channels

The rule is simple: **stdout is the command's product, stderr is everything a human reads.**

That split is what makes commands usable in a pipeline. `h5p export` prints only the resulting filename on stdout, so this works:

```bash
h5p export MyLibrary > out.txt   # out.txt contains the filename and nothing else
h5p export MyLibrary 2>/dev/null # errors and status suppressed, output intact
```

If you print status messages with `console.log`, they land in `out.txt` and break the pipeline. Use `ui.data()` for the thing your command produces, and everything else from the table below.

| Call | Channel | Renders as |
|------|---------|------------|
| `ui.data(value)` | stdout | the raw value — no prefix, never colored |
| `ui.info(message)` | stderr | `> message` |
| `ui.step(message, { depth })` | stderr | `>> message` — `depth` defaults to 2 |
| `ui.success(message)` | stderr | `> message`, green |
| `ui.warn(message)` | stderr | `> message`, yellow |
| `ui.error(error)` | stderr | `> error: message`, red |
| `ui.debug(message)` | stderr | `>>> message`, dim — only shown when verbose |
| `ui.list(items, { title, empty })` | stderr | `> title` then `  - item` lines |
| `ui.table(rows, { head })` | stdout | aligned columns |

`ui.error()` takes `unknown`, not a string: it normalizes an `Error`, a string, or any other thrown value. So the whole error-handling pattern in a command action is:

```typescript
.action(async (library) => {
  try {
    const file = await doSomething(library);
    ui.data(file);
  } catch (error) {
    ui.error(error);
  }
});
```

Colors switch off automatically when stderr is not a terminal, and honour `NO_COLOR` and `FORCE_COLOR`.

### Lists and tables

Two helpers, and the channel they use is the whole distinction between them.

`ui.list()` is **chrome** — bullets that annotate something, on stderr, suppressed by `--quiet`:

```typescript
ui.list(plugins.map((p) => `${p.name} (${p.path})`), {
  title: 'installed plugins:',
  empty: 'no plugins installed',
});
```

On a terminal the title becomes a header above a rule:

```
┌────────────────────────────────────────┐
│ installed plugins:                     │
├────────────────────────────────────────┤
│ - h5p-plugin-s3 (/path/to/test-plugin) │
│ - h5p-modern-server (/path/x)          │
└────────────────────────────────────────┘
```

Piped, the same call degrades to plain bullets:

```
> installed plugins:
  - h5p-plugin-s3 (/path/to/test-plugin)
```

`empty` replaces the whole thing with a single line when there is nothing to list.

`ui.table()` is **data** — on stdout, so it survives `--quiet` and stays pipeable:

```typescript
ui.table(rows, { head: ['NAME', 'ORG'] });
```

```
$ h5p list                          $ h5p list | head -2
┌───────────────┬────────┐          h5p-accordion  h5p
│ NAME          │ ORG    │          h5p-agamotto   otacke
├───────────────┼────────┤
│ h5p-accordion │ h5p    │
│ h5p-agamotto  │ otacke │
└───────────────┴────────┘
```

**The box and the header appear only when the stream is a terminal.** A pipeline gets bare aligned columns, never has to skip a header line, and never has to strip box characters. This is the same rule the live progress area uses, and it is what keeps `stdout is data` true.

**NOTE:**

- **Boxed output is truncated to fit; piped output never is.** When the box would exceed the terminal width, the widest column is squeezed and clipped cells get an `…`. The unboxed path does no truncation at all, so a script always receives complete values.
- Tables are **never colored**, and the unboxed form does not pad the last column, so no line carries trailing whitespace.

### Verbosity

Users control how much they see with the global `--quiet` and `--verbose` flags (these go **before** the subcommand), or with the `H5P_QUIET` / `H5P_VERBOSE` environment variables, which work anywhere. `H5P_DEBUG=1` is accepted as an alias for verbose.

```bash
h5p --verbose install h5p-blanks
H5P_QUIET=1 h5p install h5p-blanks
```

| Level | What gets through |
|-------|-------------------|
| `quiet` | `warn`, `error`, `data` only — and the progress area is disabled |
| `normal` | everything except `debug` |
| `verbose` | everything, plus error stacks |

You do not need to check the level yourself — `ui` drops what should not be shown. Put subprocess output and other noise behind `ui.debug()` and it stays out of the way until someone asks for it.

A plugin can set the level itself with `ui.setLevel('quiet' | 'normal' | 'verbose')`, for example if your command has its own output mode.

### Progress

`progress` is a way to show the user that something is progressing, such as downloading some content, calculations that may take some time etc. If your work has no measurable total you can simply pick milestones that feel logical (30 after fetching, 70 after unpacking, 100 when done) or omit the percentage entirely for a plain spinner.

```typescript
ui.progress(id, percent?, { label })   // create the row, or update it
ui.progressDone(id)                    // retire the row and free its slot
ui.progressClear()                     // drop every row
ui.setProgressLimit(3)                 // rows shown before "… N more"
```

The first `ui.progress(id)` call registers a row; `label` defaults to the id. Later calls with the same id update it. Rows render in the order they were created:

```
⠋ H5P.Blanks      ████████░░░░░░░░   55%
⠋ H5P.Question    ██░░░░░░░░░░░░░░   12%
⠋ H5P.JoubelUI    ███░░░░░░░░░░░░░   20%
  … 2 more
```

Omit `percent` for an indeterminate row — a spinner and a label, no bar. When a row finishes it **vanishes** rather than leaving a line behind, and a waiting row takes its slot, so print your own summary with `ui.success()` when the work is done.

Pair every `progress` with a `progressDone` in a `finally`, so an early return or a thrown error never strands a row on screen:

```typescript
ui.progress(id, 0, { label: 'H5P.Blanks' });
try {
  await download();
  ui.progress(id, 60);
  await build();
  ui.progress(id, 100);
} finally {
  ui.progressDone(id);
}
```

The progress area is **silent** when stderr is not a terminal, when `CI` is set, and when running quiet — so plugins never need to check for those themselves. Because finished rows leave nothing behind, keep any output you want in the log as ordinary `ui.step()` lines alongside the progress calls.

`ui.error()` clears the progress area before printing, so a failure never leaves a half-drawn frame above the message.

### Status lines

Sometimes you have detail that matters *while* it is happening and is noise afterwards — resolving a dependency tree, scanning files, checking a hundred versions. A status line is a single row that overwrites itself, so a long sequence collapses into one permanent summary of your choosing.

```typescript
ui.status(id, message)   // create the row, or replace its text
ui.statusDone(id)        // retire it — the line vanishes
```

```typescript
const id = 'resolve';
try {
  for (const dep of deps) {
    ui.status(id, `${dep} required by ${parent}`);
    await resolve(dep);
  }
} finally {
  ui.statusDone(id);
}
ui.info(`resolved ${deps.length} dependencies`);
```

Wrap it in `try/finally` so a thrown error never leaves the line on screen.

Unlike `ui.progress()`, a status message is also passed to `ui.debug()`, so the detail stays reachable when there is no terminal to draw on:

| | normal | verbose |
|---|---|---|
| **terminal** | live row only | live row, plus `>>>` lines in the scroll-back |
| **piped / CI** | nothing | `>>>` lines only |

This is what `h5p clone` does — a dozen `X required by Y` lines share one row and leave behind a single `> resolved 11 dependencies for h5p-blanks`.

### Two things to avoid

**Do not write to `process.stdout` or `process.stderr` directly.** Every `ui` call funnels through one internal point that clears the live progress area, writes your line into the scroll-back above it, and repaints. A direct write bypasses that and shreds the frame.

**Do not use `execSync` for anything that produces output.** It inherits stderr, so the subprocess writes straight past `ui` — the output escapes `--quiet` and corrupts the progress area. Capture both streams instead and hand them to `ui.debug()`:

```typescript
import { spawnSync } from 'child_process';

const result = spawnSync('npm install', { shell: true, cwd, encoding: 'utf-8' });
if (result.stdout.trim()) ui.debug(result.stdout.trim());
if (result.stderr.trim()) ui.debug(result.stderr.trim());
```

Prefer the async `spawn` if you are showing progress — a synchronous call blocks the event loop, so the spinner freezes until it returns.

### Testing your plugin's output

There is no injection seam in `ui`; tests spy on the streams directly, which also verifies that output went to the right one:

```typescript
let stderr = '';
vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
  stderr += chunk;
  return true;
});

expect(stderr).toContain('> error: something failed');
```

## Overriding adapters

Adapters are the I/O boundary in h5p-cli. Each built-in command resolves its adapter through a registry, falling back to the default implementation if no override is found. Plugins can replace any adapter by returning constructors keyed by adapter name.

### Built-in adapter keys

| Key | Used by | Interface |
|-----|---------|-----------|
| `export` | `h5p export` | `IExportAdapter` |
| `import` | `h5p import` | `IImportAdapter` |
| `list` | `h5p list` | `IListAdapter` |
| `tags` | `h5p tags` | `ITagsAdapter` |
| `deps` | `h5p deps` | `IDepsAdapter` |
| `missing` | `h5p missing` | `IMissingAdapter` |
| `install` | `h5p install`, `h5p clone` | `IInstallAdapter` |
| `verify` | `h5p verify` | `IVerifyAdapter` |
| `register` | `h5p register` | `IRegisterAdapter` |
| `create` | `h5p create` | `ICreateAdapter` |
| `core` | `h5p core` | `ICoreAdapter` |
| `setup` | `h5p core` | `ISetupAdapter` |

### Default override

When a plugin registers an adapter under a built-in key (e.g. `export`), that adapter becomes the default for the command — no flags needed:

```typescript
export default {
  name: 'my-s3-plugin',

  adapters() {
    return {
      export: S3ExportAdapter,  // replaces the default export adapter
    };
  },
};
```

### Named adapter (opt-in via --adapter flag)

You can also register adapters under custom keys. Users select them with the `--adapter` flag:

```typescript
adapters() {
  return {
    's3-export': S3ExportAdapter,
  };
}
```

```bash
h5p export MyLibrary --adapter s3-export
```

### Implementing an adapter

An adapter is a class whose constructor takes no arguments. It must implement the interface expected by the command. Check the corresponding adapter file in `src/adapters/` for the interface definition.

```typescript
// Example: custom export adapter
import { IExportAdapter } from 'h5p-cli/src/adapters/export-adapter';

class S3ExportAdapter implements IExportAdapter {
  async export(library: string, folder?: string): Promise<string> {
    // upload to S3 instead of writing locally
    return 's3://bucket/path';
  }
}
```

## Installing a plugin

### From a local path

```bash
h5p plugin install /path/to/my-plugin
```

### From a git repository

```bash
h5p plugin install https://github.com/user/h5p-cli-my-plugin.git
h5p plugin install git@github.com:user/h5p-cli-my-plugin.git
```

Git plugins are cloned into a `plugins/` directory inside h5p-cli. The `plugins/` folder is in `.gitignore`. This is to avoid having plugins leaked into the h5p-cli codebase.

### What happens on install

1. The plugin's entry point is loaded to verify it exports a `name`.
2. An entry is added to `h5p.plugins.json` (auto-created if missing).

## Managing plugins

```bash
h5p plugin list                # show installed plugins
h5p plugin uninstall my-plugin # remove by name
```

Uninstalling removes the entry from `h5p.plugins.json`. If the plugin was cloned into `plugins/`, the directory is also deleted.

## Plugin loading

Plugins are loaded at startup from `h5p.plugins.json`. Each entry has a `name` and an absolute `path` to the module. The loader:

1. `import()`s the module at the stored path
2. Calls `adapters()` if present, registering overrides in the adapter registry
3. Calls `commands()` if present, adding/replacing commands on the program

Plugins are loaded **after** all built-in commands are registered, so plugin commands **always** take precedence.

## Full example: custom storage plugin

```typescript
// h5p-cli-s3/index.ts
import { Command } from 'commander';
import type { H5PPlugin } from 'h5p-cli/plugin-types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

class S3ExportAdapter {
  async export(library, folder) {
    const client = new S3Client({ region: 'eu-west-1' });
    // ... build the .h5p, upload to S3
    return `s3://my-bucket/${library}.h5p`;
  }
}

const plugin: H5PPlugin = {
  name: 'h5p-cli-s3',

  commands() {
    const sync = new Command('s3-sync')
      .description('Sync all libraries to S3')
      .action(async () => {
        // custom sync logic
      });
    return [sync];
  },

  adapters() {
    return {
      export: S3ExportAdapter,       // replaces default export
      's3-export': S3ExportAdapter,  // also available via --adapter s3-export
    };
  },
};

export default plugin;
```

```bash
h5p plugin install /path/to/h5p-cli-s3
h5p export MyLibrary              # uses S3ExportAdapter by default
h5p export MyLibrary --adapter s3-export  # explicit selection
h5p s3-sync                       # new command from plugin
```
