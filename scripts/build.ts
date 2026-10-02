/* Builds dist/, the package that gets published: `npm run build && npm publish ./dist`.

The repo runs its TypeScript sources directly, but Node refuses to strip types for
files under node_modules, which is exactly where `npm install -g h5p-cli` puts them.
So the published package is compiled JavaScript, laid out like the repo so every
path computed from import.meta.dirname still lands on the same file.

What ships is still decided by `files` in package.json: .ts entries are compiled by
tsc, h5p.js is regenerated to load the compiled entry point, and everything else -
including the non-TypeScript files under src/ - is copied as is. */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const require = createRequire(import.meta.url);

fs.rmSync(dist, { recursive: true, force: true });

const tsc = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', path.join(root, 'tsconfig.build.json')], { stdio: 'inherit' });
if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1);
}

const copy = (relative: string): void => {
  fs.cpSync(path.join(root, relative), path.join(dist, relative), { recursive: true });
};

// tsc emits only what it compiles; anything else under src/ (src/utils/bin/h5p-ssh) is copied
const copyNonTypeScript = (relative: string): void => {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) copyNonTypeScript(child);
    else if (!entry.name.endsWith('.ts')) copy(child);
  }
};

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

for (const entry of pkg.files as string[]) {
  if (entry === 'h5p.js') {
    fs.writeFileSync(path.join(dist, 'h5p.js'), "#!/usr/bin/env node\nimport './src/index.js';\n", { mode: 0o755 });
  }
  else if (entry === 'src') {
    copyNonTypeScript('src');
  }
  else if (!entry.endsWith('.ts') && fs.existsSync(path.join(root, entry))) {
    copy(entry);
  }
}
copy('LICENSE');

const toJs = (file: string): string => file.replace(/\.ts$/, '.js');
for (const target of Object.values(pkg.exports) as Array<{ types: string; import: string }>) {
  target.types = target.types.replace(/\.ts$/, '.d.ts');
  target.import = toJs(target.import);
}
pkg.main = toJs(pkg.main);
// dist/ is the whole package, so the allowlist and the dev-only fields go
for (const field of ['private', 'scripts', 'devDependencies', 'files']) {
  delete pkg[field];
}
fs.writeFileSync(path.join(dist, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`built ${path.relative(process.cwd(), dist) || '.'} - publish with: npm publish ./dist`);
