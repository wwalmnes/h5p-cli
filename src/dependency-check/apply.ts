import fs from 'fs';
import {
  findDependencyNumber,
  findTokenOffsets,
  findTopLevelNumber,
  replaceSpan,
} from './json-edit.ts';
import type { Edit, Plan } from './plan.ts';

export type ApplyResult = {
  filesWritten: string[];
  /** Edits that could not be located in the file; nothing was written for these. */
  failures: { relFile: string; detail: string; reason: string }[];
};

function applyEdit(raw: string, edit: Edit): { raw: string; changed: boolean; reason?: string } {
  switch (edit.kind) {
    case 'library-version': {
      const found = findTopLevelNumber(raw, edit.key);
      if (!found) return { raw, changed: false, reason: `no top-level "${edit.key}" found` };
      if (found.value === edit.value) return { raw, changed: false };
      return {
        raw: replaceSpan(raw, found.token.valueStart, found.valueEnd, String(edit.value)),
        changed: true,
      };
    }

    case 'semantics-option': {
      // Replace every occurrence: a content type may offer the same
      // sub-library in several fields, and all of them are equally stale.
      const offsets = findTokenOffsets(raw, edit.token);
      if (offsets.length === 0) return { raw, changed: false, reason: `${edit.token} not found` };
      return { raw: raw.split(edit.token).join(edit.replacement), changed: true };
    }

    case 'dependency-version': {
      const found = findDependencyNumber(raw, edit.dependencyName, edit.key);
      if (!found) {
        return { raw, changed: false, reason: `no ${edit.key} for ${edit.dependencyName}` };
      }
      if (found.value === edit.value) return { raw, changed: false };
      return {
        raw: replaceSpan(raw, found.token.valueStart, found.valueEnd, String(edit.value)),
        changed: true,
      };
    }
  }
}

export function applyPlan(plan: Plan): ApplyResult {
  const byFile = new Map<string, Edit[]>();

  for (const node of plan.order) {
    for (const edit of node.edits) {
      const bucket = byFile.get(edit.file);
      if (bucket) bucket.push(edit);
      else byFile.set(edit.file, [edit]);
    }
  }

  const filesWritten: string[] = [];
  const failures: ApplyResult['failures'] = [];

  for (const [file, edits] of byFile) {
    let raw = fs.readFileSync(file, 'utf-8');
    let changed = false;

    for (const edit of edits) {
      const result = applyEdit(raw, edit);
      raw = result.raw;
      if (result.changed) changed = true;
      else if (result.reason) {
        failures.push({ relFile: edit.relFile, detail: edit.detail, reason: result.reason });
      }
    }

    if (changed) {
      fs.writeFileSync(file, raw);
      filesWritten.push(file);
    }
  }

  return { filesWritten, failures };
}
