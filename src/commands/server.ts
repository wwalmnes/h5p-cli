import { Command } from 'commander';
import { ui } from '../lib/ui.ts';
import config from '../config.ts';

export function serverCommand(): Command {
  return new Command('server')
    .description('Run the dev server')
    .option('--port <port>', 'Override the default port')
    .action(async (options) => {
      console.log('options: ', options)
      // logic/* is shared with the CLI; suppress its progress chrome so it
      // never animates into the server log. Replaces the old
      // `process.argv[2] !== 'server'` checks in compute-dependencies.
      ui.setLevel('quiet');
      
      // Just override the config for now
      if (options.port) {
        config.port = options.port;
        config.api = `http://localhost:${config.port}`; 
      }

      await import('../server/server.ts');
    });
}
