# Developing Plugins with NPM Workspace

This guide covers how to develop h5p-cli plugins using the [npm workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces) setup. For the full plugin API reference (commands, adapters, interfaces), see [plugins.md](plugins.md).

Note: This is _not_ a requirement on how to work with h5p-cli and plugins, but a suggestion that can make your life easier :).

## Workspace structure

You should structure the project and repositories like so:

```
h5p-cli-workspace/
  package.json          # root workspace config
  h5p-cli/              # the CLI itself
  plugins/
    my-plugin/          # your plugins
    other-plugin/       # other plugins you checked out
```

The root `package.json` declares:

```json
{
  "workspaces": ["h5p-cli", "plugins/*"]
}
```

This gives you:

- **Automatic linking** -- plugins under `plugins/` can `import` from `h5p-cli` without publishing or manual `npm link`
- **Shared `node_modules`** -- dependencies are hoisted to the workspace root, avoiding duplication

## Creating a new plugin

### 1. Create the directory and package.json

```bash
mkdir plugins/my-plugin
cd plugins/my-plugin
```

Create `package.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "main": "index.ts",
  "type": "module",
  "peerDependencies": {
    "commander": "^14.0.3",
    "h5p-cli": "^1.1.5"
  }
}
```

Key fields:

| Field | Why |
|-------|-----|
| `"main"` | Points to your entry file. Use `index.ts` for TypeScript or `index.js` for JavaScript |
| `"type": "module"` | Required. h5p-cli is ESM throughout |
| `peerDependencies` | Resolved from the workspace root. Keeps your plugin from bundling its own copy |

### 2. Create the entry point

You can write plugins in TypeScript or plain JavaScript.

**TypeScript** (`index.ts`):

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

**JavaScript** (`index.js`):

```javascript
import { Command } from 'commander';

export default {
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
```

Remember to set `"main"` in `package.json` to match your entry file.

### 3. Install dependencies

From the workspace root:

```bash
npm install
```

This links everything together. Your plugin can now import from `h5p-cli`.

## Registering the plugin with h5p-cli

```bash
h5p plugin install plugins/my-plugin
```

This adds an entry to `h5p-cli/h5p.plugins.json`:

```json
{
  "plugins": [
    {
      "name": "my-plugin",
      "path": "/absolute/path/to/plugins/my-plugin"
    }
  ]
}
```

The plugin is now loaded on every `h5p` invocation.

## Available imports from h5p-cli

The CLI exposes several entry points that plugins can use:

| Import path | What it provides |
|-------------|-----------------|
| `h5p-cli/plugin-types` | `H5PPlugin` and `AdapterOverrides` types |
| `h5p-cli/utils` | Utility functions (`fromTemplate`, `parseGitUrl`, etc.) |
| `h5p-cli/logic` | Core logic layer (library parsing, registry, content operations) |
| `h5p-cli/config` | Configuration loader (paths, settings) |
| `h5p-cli/compute-dependencies` | Dependency resolution helpers |

Example:

```typescript
import { fromTemplate, parseGitUrl } from 'h5p-cli/utils';
import logic from 'h5p-cli/logic';
import config from 'h5p-cli/config';
```

## Running and testing

No build step is needed. Node v24+ strips TypeScript types natively, so you can write `.ts` files and run them directly.

```bash
# Run your new command
h5p greet Alice

# Verify the plugin is registered
h5p plugin list
```

If your plugin has its own dependencies (not peer deps), add them to your plugin's `package.json` and run `npm install` from the workspace root.


## Tips

- **TypeScript works out of the box.** Use `.ts` for your entry point and imports. No compilation step required (Node v24+ strips types natively).
- **JavaScript works too.** Use `.js` with ESM `import` syntax. All `h5p-cli/*` imports work the same way.
- **Workspace commands from root.** You can e.g. run `npm run test --workspace=h5p-cli`. See [npm workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces) for more info.

