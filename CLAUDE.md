# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build   # Compile TypeScript → dist/index.js (CJS bundle)
npm run dev     # Watch mode build
```

No test framework is configured.

## Architecture

This is a CLI tool for developing and testing H5P content types. It uses **Commander.js** with TypeScript, compiled to a single CommonJS bundle via tsup.

### Entry points
- `h5p.js` — executable shim; just `require('./dist/index.js')`
- `src/index.ts` — creates the Commander program, registers all commands, calls `setupFolders()`, then calls `program.parse()`
- `dist/index.js` — compiled output (not committed)

### Command pattern
Every command is a factory function in `src/commands/`:

```typescript
export function listCommand(): Command {
  return new Command('list')
    .description('...')
    .argument('[arg]', '...')
    .action(async (arg) => {
      const args = z.object({ arg: z.string().optional() }).parse({ arg });
      const logic = require('../../logic');
      // ...
    });
}
```

- `src/commands/*.ts` — 14 root commands (export, import, list, tags, deps, missing, install, clone, core, setup, branches, register, verify, server, help)
- `src/commands/utils/index.ts` — registers ~37 utils subcommands from `src/commands/utils/*.ts`
- `src/lib/setup-folders.ts` — creates content/, temp/, libraries/, uploads/ dirs (called on startup except for `utils`, `help`, `--help`, `-h`, `--version`, `-V`)

### Legacy JS integration
The TypeScript commands `require()` the original JS files (`logic.js`, `api.js`, `server.js`, `config.js`, `assets/utils/*.js`) typed as `any`. These files remain intact. The migration to TypeScript is ongoing.

### Key conventions
- Zod schemas validate CLI arguments inside action handlers
- Action handlers are async with try/catch, logging errors via `console.log`
- `branches` command has alias `@branches`
- `setup.ts` exports `runSetup()`, `register.ts` exports `runRegister()` (used by other commands, not just their own Commander action)
