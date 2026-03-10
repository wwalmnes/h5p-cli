import { Command } from 'commander';
import * as fs from 'fs';
import { runSetup } from './setup';
import logic from '../../logic';
import config from '../../configLoader';

export function coreCommand(): Command {
  return new Command('core')
    .description('Installs core h5p libraries')
    .action(async () => {
      try {
        for (const item of config.core.clone) {
          const folder = `${config.folders.libraries}/${item}`;
          if (fs.existsSync(folder)) {
            console.log(`>> ~ skipping ${item}; it already exists.`);
            continue;
          }
          console.log(`>> + installing ${item}`);
          logic.clone('h5p', item, 'master', item);
        }
        for (const item of config.core.setup) {
          await runSetup(item);
        }
        console.log('> done setting up core libraries');
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
