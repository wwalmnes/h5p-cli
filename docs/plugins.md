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

```typescript
import { Command } from 'commander';
import type { H5PPlugin } from 'h5p-cli/plugin-types';

const plugin: H5PPlugin = {
  name: 'my-plugin',

  commands() {
    return [
      new Command('greet')
        .description('Say hello')
        .argument('[name]', 'Name to greet')
        .action((name) => {
          console.log(`Hello, ${name ?? 'world'}!`);
        }),
    ];
  },
};

export default plugin;
```

After installing, `h5p greet Alice` prints `Hello, Alice!`.

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
