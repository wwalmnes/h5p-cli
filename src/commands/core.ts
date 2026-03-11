import { Command } from 'commander';
import { CoreAdapter } from '../adapters/core-adapter';
import { CoreService } from '../services/core-service';
import { SetupAdapter } from '../adapters/setup-adapter';
import { RegisterAdapter } from '../adapters/register-adapter';
import { RegisterService } from '../services/register-service';
import { SetupService } from '../services/setup-service';
import config from '../../configLoader';

export function coreCommand(service?: CoreService): Command {
  const svc = service ?? new CoreService(
    new CoreAdapter(),
    new SetupService(
      new SetupAdapter(),
      new RegisterService(new RegisterAdapter(), config.registry),
      config.folders.libraries
    ),
    config.core.clone,
    config.core.setup,
    config.folders.libraries
  );
  return new Command('core')
    .description('Installs core h5p libraries')
    .action(async () => {
      try {
        await svc.core();
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
