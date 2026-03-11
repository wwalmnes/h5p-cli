import { Command } from 'commander';
import { z } from 'zod';
import { VerifyAdapter } from '../adapters/verify-adapter';
import { VerifyService } from '../services/verify-service';

const verifyArgsSchema = z.object({
  library: z.string(),
});

export function verifyCommand(service?: VerifyService): Command {
  const svc = service ?? new VerifyService(new VerifyAdapter());
  return new Command('verify')
    .description('Generates report that verifies if an h5p library and its dependencies have been correctly computed & installed')
    .argument('<library>', 'Library name')
    .action(async (library: string) => {
      const args = verifyArgsSchema.parse({ library });
      try {
        await svc.verify(args.library);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
