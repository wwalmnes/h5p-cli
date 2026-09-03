import { Command } from 'commander';
import { z } from 'zod';
import { DepsAdapter, type IDepsAdapter } from '../adapters/deps-adapter.ts';
import { DepsService } from '../services/deps-service.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import { ui } from '../lib/ui.ts';

const depsArgsSchema = z.object({
  library: z.string(),
  mode: z.union([z.literal('view'), z.literal('edit')], {
    errorMap: () => ({ message: 'Mode must be "view" or "edit"' }),
  }).optional(),
  version: z.string().optional(),
  folder: z.string().optional(),
});

export function depsCommand(service?: DepsService): Command {
  return new Command('deps')
    .description('Computes dependencies for h5p library')
    .argument('<library>', 'Library name')
    .argument('[mode]', 'Mode (view or edit)')
    .argument('[version]', 'Version')
    .argument('[folder]', 'Folder')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action(async (library: string, mode: 'view' | 'edit' | undefined, version: string | undefined, folder: string | undefined, options) => {
      const svc = service ?? new DepsService(adapterRegistry.resolve<IDepsAdapter>(options.adapter ?? 'deps') ?? new DepsAdapter());
      const result = depsArgsSchema.safeParse({ library, mode, version, folder });

      if (!result.success) {
        for (const issue of result.error.issues) {
          ui.error(issue.message);
        }
        process.exitCode = 1;
        return;
      }

      const args = result.data;

      try {
        await svc.deps(args.library, args.mode, args.version, args.folder);
      } catch (error) {
        ui.fail(error);
      }
    });
}
