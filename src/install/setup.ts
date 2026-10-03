import config from '../config/loader.ts';
import { isReleaseVersion, isSafeGitRef, machineToShort } from '../h5p/h5p-utils.ts';
import { ui } from '../ui/ui.ts';
import { computeDependencies } from './dependencies.ts';
import { installDependencies } from './install.ts';
import { isRepoUrl, register } from './register.ts';

/* Resolve once, install once.

This used to run one full resolution for the view graph, then another per
dependency in it, then a third for the edit graph purely to collect warnings,
then reset `toSkip` and do the view and edit graphs over again — about N+4
traversals of the same graph, roughly 61 of them for h5p-interactive-book.

One 'edit' resolution replaces all of it. `mode` is applied at every node, not
only at the root, so an edit resolution follows preloadedDependencies, the
libraries named in semantics.json, *and* editorDependencies the whole way
down. View edges are a subset of edit edges from the same root, so the edit
graph already contains everything the view pass found and everything the
per-dependency edit passes were reaching one traversal at a time. */
export async function setup(library: string, ref?: string, download?: string, concurrency?: number): Promise<void> {
  const missingOptionals: Record<string, any> = {};

  if (isRepoUrl(library)) {
    const entry = await register(library);
    library = machineToShort(Object.keys(entry)[0]);
  }

  if (ref && !isSafeGitRef(ref)) {
    throw new Error(`invalid ref "${ref}"`);
  }

  const action = parseInt(download ?? '0') ? 'download' : 'clone';
  const latest = !ref;
  // A release pin is resolved through the graph and cloned at the resulting
  // patch. Anything else is a git branch/tag for the root library only;
  // deps still follow that ref's library.json.
  const rootRef = ref && !isReleaseVersion(ref) ? { library, ref } : undefined;

  const result = await computeDependencies(library, 'edit', ref);
  for (const item in result) {
    if (result[item].id) continue;
    if (!result[item].optional) {
      throw new Error(`unregistered ${item} library required by ${result[item].parent}`);
    }
    missingOptionals[item] ??= result[item];
  }

  ui.info(`${action} ${library} library dependencies into "${config.folders.libraries}" folder`);
  await installDependencies(action, result, latest, [], concurrency, rootRef);

  if (Object.keys(missingOptionals).length) {
    ui.warn('missing optional libraries');
    for (const item in missingOptionals) {
      ui.data(`${item} (${missingOptionals[item].optional ? 'optional' : 'required'}) required by ${missingOptionals[item].parent}`);
    }
  }
  ui.info(`done setting up ${library}`);
}
