import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { z } from 'zod';
import config from '../../configLoader.ts';
import { ui } from '../lib/ui.ts';

const createArgsSchema = z.object({
  name: z.string().min(1),
});

/** Scaffold H5P.<name>-1.0 into the libraries folder. */
function scaffold(name: string): void {
  const machineName = `H5P.${name}`;
  const dir = path.join(process.cwd(), config.folders.libraries, `${machineName}-1.0`);

  if (fs.existsSync(dir)) {
    ui.info(`already exists: ${dir}`);
    return;
  }

  fs.mkdirSync(dir, { recursive: true });

  const libraryJson = {
    title: name,
    description: '',
    majorVersion: 1,
    minorVersion: 0,
    patchVersion: 0,
    runnable: 1,
    author: '',
    license: 'MIT',
    machineName,
    preloadedJs: [{ path: 'index.js' }],
  };
  fs.writeFileSync(path.join(dir, 'library.json'), JSON.stringify(libraryJson, null, 2));

  const semantics = [
    { name: 'greeting', label: 'Greeting', type: 'text', default: 'Hello world!' },
  ];
  fs.writeFileSync(path.join(dir, 'semantics.json'), JSON.stringify(semantics, null, 2));

  const indexJs = `var H5P = H5P || {};

H5P.${name} = (function ($) {
  function C(options, id) {
    this.options = options;
    this.id = id;
  }

  C.prototype.attach = function ($container) {
    console.log('hello world');
  };

  return C;
})(H5P.jQuery);
`;
  fs.writeFileSync(path.join(dir, 'index.js'), indexJs);

  ui.info(`created ${dir}`);
}

export function createCommand(): Command {
  return new Command('create')
    .description('Scaffold a new H5P content type in the libraries folder')
    .argument('<name>', 'Content type name (e.g. MyContentType)')
    .action((name: string) => {
      try {
        const args = createArgsSchema.parse({ name });
        scaffold(args.name);
      } catch (error) {
        ui.fail(error);
      }
    });
}
