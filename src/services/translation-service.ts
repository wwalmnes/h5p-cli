import { processRepos, RepoResult } from '../lib/process-repos';
import { TranslationAdapter, ITranslationAdapter } from '../adapters/translation-adapter';
import { removeUntranslatables, itemUntranslatable } from '../lib/semantics-utils';

export interface TranslationResult {
  name: string;
  skipped?: boolean;
  failed?: boolean;
  msg?: string;
}

export class TranslationService {
  constructor(private adapter: ITranslationAdapter = new TranslationAdapter()) {}

  async createLanguageFile(repo: string, langCode: string): Promise<TranslationResult> {
    let semantics: any;
    try {
      semantics = await this.adapter.readSemanticsJson(repo);
    } catch (err: any) {
      return { name: repo, failed: true, msg: String(err.message ?? err) };
    }

    const data = { semantics: removeUntranslatables(semantics) };
    try {
      await this.adapter.writeLanguageFile(repo, langCode, data);
    } catch (err: any) {
      return { name: repo, failed: true, msg: String(err.message ?? err) };
    }

    return { name: repo, msg: `${repo}/language/${langCode}.json created` };
  }

  async importLanguageFiles(sourceDir: string, repos: string[]): Promise<RepoResult<TranslationResult>[]> {
    return processRepos(repos, async (repo) => {
      let files: string[];
      try {
        files = await this.adapter.readSourceLanguageDir(sourceDir, repo);
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
          const utf8 = await this.adapter.convertToUtf8(filePath);
          const translation = JSON.parse(utf8);
          await this.adapter.writeLanguageFile(repo, lang[1], translation);
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

  async addEnglishTexts(
    langCode: string,
    repos: string[],
    populate: boolean
  ): Promise<RepoResult<TranslationResult>[]> {
    return processRepos(repos, async (repo) => {
      let semantics: any;
      try {
        semantics = await this.adapter.readSemanticsJson(repo);
      } catch (err: any) {
        return { name: repo, failed: true, msg: String(err.message ?? err) };
      }

      const { content: existing, error } = await this.adapter.readLanguageFile(repo, langCode);
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
        await this.adapter.writeLanguageFile(repo, langCode, translation);
      } catch (err: any) {
        return { name: repo, failed: true, msg: String(err.message ?? err) };
      }

      return { name: repo };
    });
  }

  async copyTranslation(
    from: string,
    to: string,
    repos: string[]
  ): Promise<RepoResult<TranslationResult>[]> {
    return processRepos(repos, async (repo) => {
      const { content: source, error } = await this.adapter.readLanguageFile(repo, from);
      if (error) return { name: repo, failed: true, msg: error };

      const commitInfo = await this.adapter.getLastCommitInfo(repo, `language/${from}.json`);

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
        await this.adapter.writeLanguageFile(repo, to, target);
      } catch (err: any) {
        return { name: repo, failed: true, msg: String(err.message ?? err) };
      }

      return { name: repo };
    });
  }

  async packTranslation(
    lang: string,
    repos: string[],
    outputFile: string
  ): Promise<number> {
    const { archive, waitForClose } = this.adapter.createZipArchive(outputFile);

    let count = 0;
    await processRepos(repos, async (repo) => {
      const filePath = `${repo}/language/${lang}.json`;
      const added = await this.adapter.appendToZip(archive, filePath);
      if (added) count++;
      return { name: repo, msg: added ? 'added' : 'skipped' };
    }, { skipCheck: true });

    await archive.finalize();
    await waitForClose;
    return count;
  }

  async updateTranslations(repos: string[]): Promise<RepoResult<TranslationResult>[]> {
    return processRepos(repos, async (repo) => {
      let semantics: any;
      try {
        semantics = await this.adapter.readSemanticsJson(repo);
      } catch (err: any) {
        return { name: repo, failed: true, msg: String(err.message ?? err) };
      }

      const languageFiles = (await this.adapter.readLanguageDir(repo))
        .filter(f => f.endsWith('.json'));

      if (!languageFiles.length) {
        return { name: repo, skipped: true, msg: 'no language files' };
      }

      const writes: Promise<void>[] = [];

      for (let i = 0; i < languageFiles.length; i++) {
        const file = languageFiles[i];
        const isLast = i === languageFiles.length - 1;
        const langCode = file.replace('.json', '');

        const { content: existing } = await this.adapter.readLanguageFile(repo, langCode);
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

        writes.push(this.adapter.writeLanguageFile(repo, langCode, { semantics: updated }));
      }

      await Promise.all(writes);
      await this.adapter.writeSemanticsJson(repo, semantics);

      return { name: repo };
    });
  }
}

// ─── Pure helper functions ────────────────────────────────────────────────────

// removeUntranslatables and itemUntranslatable are imported from ../lib/semantics-utils

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
