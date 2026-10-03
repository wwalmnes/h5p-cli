import { spawn } from 'child_process';
import fs from 'fs';
import archiver from 'archiver';
import { processRepos, type RepoResult } from '../repos/process-repos.ts';
import type { RepoOpResult } from '../repos/repo-types.ts';
import { removeUntranslatables } from '../h5p/semantics-utils.ts';
import { spawnGit } from '../repos/git.ts';

export type TranslationResult = RepoOpResult;

// ─── File access ──────────────────────────────────────────────────────────────

function readSemanticsJson(repo: string): any {
  return JSON.parse(fs.readFileSync(`${repo}/semantics.json`).toString());
}

async function readLanguageFile(repo: string, langCode: string): Promise<{ content?: any; error?: string }> {
  try {
    const raw = await fs.promises.readFile(`${repo}/language/${langCode}.json`);
    return { content: JSON.parse(raw.toString()) };
  } catch (err: any) {
    const msg = err.toString();
    return { error: msg.includes('no such file') || msg.includes('not a directory') ? 'not a library' : msg };
  }
}

async function writeLanguageFile(repo: string, langCode: string, data: any): Promise<void> {
  await fs.promises.writeFile(`${repo}/language/${langCode}.json`, JSON.stringify(data, null, 2) + '\n');
}

async function readLanguageDir(repo: string): Promise<string[]> {
  try {
    return await fs.promises.readdir(`${repo}/language`);
  } catch {
    return [];
  }
}

function capture(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { env: process.env });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', data => { stdout += data.toString(); });
    proc.stderr.on('data', data => { stderr += data.toString(); });
    proc.on('error', reject);
    proc.on('close', () => resolve({ stdout, stderr }));
  });
}

async function convertToUtf8(filePath: string): Promise<string> {
  const { stdout: charsetResult } = await capture('file', ['-i', filePath]);
  const match = charsetResult.match(/charset=([^\n\r ]+)/);
  if (!match || !match[1]) throw new Error('unable to detect charset');

  const { stdout, stderr } = await capture('iconv', ['-f', match[1], '-t', 'utf-8', filePath]);
  if (stderr) throw new Error(stderr);
  return stdout;
}

async function getLastCommitInfo(repo: string, file: string): Promise<{ commit: string; date: string } | null> {
  const { stdout } = await spawnGit(repo, ['log', '-n 1', '--format=%h %at ', file]);
  if (!stdout) return null;
  const parts = stdout.trim().split(' ');
  return { commit: parts[0], date: parts[1] };
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function createLanguageFile(repo: string, langCode: string): Promise<TranslationResult> {
  let semantics: any;
  try {
    semantics = readSemanticsJson(repo);
  } catch (err: any) {
    return { name: repo, failed: true, msg: String(err.message ?? err) };
  }

  try {
    await writeLanguageFile(repo, langCode, { semantics: removeUntranslatables(semantics) });
  } catch (err: any) {
    return { name: repo, failed: true, msg: String(err.message ?? err) };
  }

  return { name: repo, msg: `${repo}/language/${langCode}.json created` };
}

export async function importLanguageFiles(sourceDir: string, repos: string[]): Promise<RepoResult<TranslationResult>[]> {
  return processRepos(repos, async (repo) => {
    let files: string[];
    try {
      files = await fs.promises.readdir(`${sourceDir}/${repo}/language`);
    } catch (err: any) {
      const msg = String(err.message ?? err);
      if (msg.includes('ENOENT') || msg.includes('no such file')) {
        return { name: repo, skipped: true, msg: 'no language folder found' };
      }
      return { name: repo, failed: true, msg };
    }

    const added: string[] = [];
    const failed: string[] = [];

    await Promise.all(files.map(async (file) => {
      const lang = file.match(/^([a-z]{2})\.json$/);
      if (!lang) return;

      const langCode = lang[1].toUpperCase();
      const filePath = `${sourceDir}/${repo}/language/${file}`;

      try {
        const translation = JSON.parse(await convertToUtf8(filePath));
        await writeLanguageFile(repo, lang[1], translation);
        added.push(langCode);
      } catch {
        failed.push(langCode);
      }
    }));

    let msg: string | undefined;
    let isFailed = false;
    if (added.length) msg = `added ${added.join(', ')}`;
    if (failed.length) {
      isFailed = true;
      msg = (msg ? msg + ', ' : '') + `failed to add ${failed.join(', ')}`;
    }

    return { name: repo, failed: isFailed || undefined, msg };
  });
}

export async function addEnglishTexts(
  langCode: string,
  repos: string[],
  populate: boolean
): Promise<RepoResult<TranslationResult>[]> {
  return processRepos(repos, async (repo) => {
    let semantics: any;
    try {
      semantics = readSemanticsJson(repo);
    } catch (err: any) {
      return { name: repo, failed: true, msg: String(err.message ?? err) };
    }

    const { content: existing, error } = await readLanguageFile(repo, langCode);
    if (error && error !== 'not a library') {
      return { name: repo, failed: true, msg: error };
    }

    const translation: any = existing ?? {};
    translation.semantics = updateTranslationFields(
      semantics,
      translation.semantics,
      (field: any, attr: string, source: any, target: any) => {
        if (
          attr === 'label' || attr === 'description' || attr === 'entity' ||
          attr === 'placeholder' || (attr === 'default' && field.type === 'text')
        ) {
          target[`english${attr[0].toUpperCase()}${attr.slice(1)}`] = field[attr];
          const fillText = populate ? field[attr] : 'TODO';
          target[attr] = source?.[attr] ?? fillText;
          return true;
        }
      }
    );

    try {
      await writeLanguageFile(repo, langCode, translation);
    } catch (err: any) {
      return { name: repo, failed: true, msg: String(err.message ?? err) };
    }

    return { name: repo };
  });
}

export async function copyTranslation(
  from: string,
  to: string,
  repos: string[]
): Promise<RepoResult<TranslationResult>[]> {
  return processRepos(repos, async (repo) => {
    const { content: source, error } = await readLanguageFile(repo, from);
    if (error) return { name: repo, failed: true, msg: error };

    const commitInfo = await getLastCommitInfo(repo, `language/${from}.json`);

    const target: any = {};
    if (commitInfo) {
      target.commit = commitInfo.commit;
      target.date = commitInfo.date;
    }

    target.semantics = updateTranslationFields(
      source.semantics,
      undefined,
      (field: any, attr: string, _source: any, tgt: any) => {
        if (attr.startsWith('english')) {
          tgt[attr] = field[attr];
          return true;
        }
        if (
          attr === 'label' || attr === 'description' || attr === 'entity' ||
          (attr === 'default' && field.type === 'text')
        ) {
          tgt[attr] = 'TODO';
          return true;
        }
      }
    );

    try {
      await writeLanguageFile(repo, to, target);
    } catch (err: any) {
      return { name: repo, failed: true, msg: String(err.message ?? err) };
    }

    return { name: repo };
  });
}

export async function packTranslation(
  lang: string,
  repos: string[],
  outputFile: string
): Promise<number> {
  const output = fs.createWriteStream(outputFile);
  const archive = archiver('zip');
  const closed = new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });
  archive.pipe(output);

  let count = 0;
  await processRepos(repos, async (repo) => {
    const filePath = `${repo}/language/${lang}.json`;
    let added = false;
    try {
      archive.append(await fs.promises.readFile(filePath), { name: filePath });
      added = true;
      count++;
    } catch {
      // no translation for this language in this repo
    }
    return { name: repo, msg: added ? 'added' : 'skipped' };
  }, { skipCheck: true });

  await archive.finalize();
  await closed;
  return count;
}

export async function updateTranslations(repos: string[]): Promise<RepoResult<TranslationResult>[]> {
  return processRepos(repos, async (repo) => {
    let semantics: any;
    try {
      semantics = readSemanticsJson(repo);
    } catch (err: any) {
      return { name: repo, failed: true, msg: String(err.message ?? err) };
    }

    const languageFiles = (await readLanguageDir(repo)).filter(f => f.endsWith('.json'));

    if (!languageFiles.length) {
      return { name: repo, skipped: true, msg: 'no language files' };
    }

    const writes: Promise<void>[] = [];

    for (let i = 0; i < languageFiles.length; i++) {
      const file = languageFiles[i];
      const isLast = i === languageFiles.length - 1;
      const langCode = file.replace('.json', '');

      const { content: existing } = await readLanguageFile(repo, langCode);
      if (!existing?.semantics) continue;

      const updated = updateTranslationFields(
        semantics,
        existing.semantics,
        (field: any, attr: string, source: any, target: any) => {
          if (
            attr === 'important' || attr === 'label' || attr === 'description' ||
            attr === 'entity' || attr === 'placeholder' ||
            (attr === 'default' && field.type === 'text')
          ) {
            target[attr] = source?.[attr] ?? field[attr];
            return true;
          }
        },
        isLast  // cleanup: remove state from semantics on last language pass
      );

      writes.push(writeLanguageFile(repo, langCode, { semantics: updated }));
    }

    await Promise.all(writes);
    await fs.promises.writeFile(`${repo}/semantics.json`, JSON.stringify(semantics, null, 2) + '\n');

    return { name: repo };
  });
}

// ─── Pure helper functions ────────────────────────────────────────────────────

function updateTranslationFields(
  semantics: any,
  translation: any,
  handler: Function,
  cleanup?: boolean
): any {
  let updated = false;
  if (translation === undefined) translation = [];
  let translationOffset = 0;

  for (let i = 0; i < semantics.length; i++) {
    const field = semantics[i];
    const translationIndex = i + translationOffset;

    if (field.state === 'removed') {
      translation.splice(translationIndex, 1);
      updated = true;
      if (cleanup) { semantics.splice(i, 1); i--; }
      else translationOffset--;
      continue;
    }

    const fieldHasChanged = field.state === 'new' || field.state === 'updated';
    const fieldTranslation = updateTranslationField(
      field,
      fieldHasChanged ? undefined : translation[translationIndex],
      handler,
      cleanup
    );

    if (field.state === 'new') {
      translation.splice(translationIndex, 0, fieldTranslation);
    } else {
      translation[translationIndex] = fieldTranslation;
    }
    if (cleanup) delete field.state;

    if (translation[translationIndex] !== undefined) updated = true;
    else translation[translationIndex] = {};
  }

  return updated ? translation : undefined;
}

function updateTranslationField(
  field: any,
  oldTranslation: any,
  handler: Function,
  cleanup?: boolean
): any {
  const updatedTranslation: any = {};
  let updated = false;

  for (const attr in field) {
    if (attr === 'field') {
      updatedTranslation.field = updateTranslationField(
        field.field,
        oldTranslation?.field,
        handler,
        cleanup
      );
      if (updatedTranslation.field !== undefined) updated = true;
    } else if (attr === 'fields' || attr === 'widgets' || attr === 'options') {
      updatedTranslation[attr] = updateTranslationFields(
        field[attr],
        oldTranslation?.[attr],
        handler,
        cleanup
      );
      if (updatedTranslation[attr] !== undefined) updated = true;
    } else {
      const status = handler(field, attr, oldTranslation, updatedTranslation);
      if (!updated && status) updated = true;
    }
  }

  return updated ? updatedTranslation : undefined;
}
