/** Presentation helpers for a bump plan. */
import type { BumpNode, Plan } from './plan.ts';
import { SELF_WHERE, type Conflict, type InconsistencyReport } from './inconsistencies.ts';
import { formatVersion } from './version.ts';

/** How many referenced libraries to name before summarising the rest. */
const MAX_VIAS = 3;

function references(node: BumpNode): string {
  const vias = [...new Set(node.causes.map((cause) => cause.via))];
  if (vias.length === 1) return `references ${vias[0]}`;

  if (vias.length > MAX_VIAS) {
    return `references ${vias.slice(0, MAX_VIAS).join(', ')} and ${vias.length - MAX_VIAS} more`;
  }
  return `references ${vias.slice(0, -1).join(', ')} and ${vias[vias.length - 1]}`;
}

function reason(node: BumpNode): string {
  if (!node.seed) return references(node);

  // A named library can also sit downstream of another named library — bumping
  // Accordion and Column together, where Column offers Accordion. It is one
  // bump, and both halves of the reason matter.
  if (node.causes.length === 0) return 'the bump you asked about';
  return `the bump you asked about; also ${references(node)}`;
}

/** Longest seed -> ... -> node path, so the report can explain the ripple. */
export function chain(plan: Plan, node: BumpNode): string[] {
  const byName = new Map(plan.order.map((entry) => [entry.machineName, entry]));
  const path: string[] = [node.machineName];
  const seen = new Set<string>([node.machineName]);

  let current = node;
  while (!current.seed && current.causes.length > 0) {
    const next = byName.get(current.causes[0]!.via);
    if (!next || seen.has(next.machineName)) break;
    path.unshift(next.machineName);
    seen.add(next.machineName);
    current = next;
  }

  return path;
}

/** Column headings for {@link planRows}. */
export function planHead(plan: Plan): string[] {
  const head = ['#', 'Library', 'From', 'To', 'Reason'];
  return plan.cycles.length > 0 ? [...head, 'Cycle'] : head;
}

/**
 * The ordered bump list, one row per library. This is the answer to the
 * question, so it is rendered as a table on stdout rather than prose.
 */
export function planRows(plan: Plan): string[][] {
  const withCycles = plan.cycles.length > 0;

  return plan.order.map((node, position) => {
    const row = [
      `${position + 1}`,
      node.machineName,
      formatVersion(node.from),
      formatVersion(node.to),
      reason(node),
    ];
    if (withCycles) row.push(node.cycle === undefined ? '' : `${node.cycle + 1}`);
    return row;
  });
}

/** `<file>:<line>  <detail>` for each edit a bump needs, plus any notes. */
export function editLines(node: BumpNode): string[] {
  const lines: string[] = [];

  for (const edit of node.edits) {
    const at = edit.lines.length > 0 ? `:${edit.lines.join(',')}` : '';
    lines.push(`${edit.relFile}${at}  ${edit.detail}`);
    if ('note' in edit && edit.note) lines.push(`  note: ${edit.note}`);
  }

  return lines;
}

/** `H5P.Column <-> H5P.Row` for each reference cycle. */
export function cycleLines(plan: Plan): string[] {
  return plan.cycles.map((group) => group.join(' <-> '));
}

/** One line per reference that already points at the new version. */
export function upToDateLines(plan: Plan): string[] {
  return plan.upToDate.map(
    (entry) =>
      `${entry.machineName} already points at ${entry.dependencyName} ${formatVersion(entry.pinned)}`,
  );
}

export function summary(plan: Plan): string {
  const dependents = plan.order.filter((node) => !node.seed).length;
  if (dependents === 0) return 'No other library needs a minor bump.';
  return `${dependents} other librar${dependents === 1 ? 'y' : 'ies'} need${dependents === 1 ? 's' : ''} a minor bump — bump them in this order:`;
}

// ------------------------------------------------------- inconsistencies

/**
 * One row per conflicting reference, so the table reads as "this file, this
 * line, pins this version" — the three things needed to go and fix it.
 */
export function conflictRows(conflicts: Conflict[]): string[][] {
  return conflicts.flatMap((conflict) =>
    conflict.pins.map((pin) => [
      conflict.library.machineName,
      conflict.machineName,
      formatVersion(pin.version),
      pin.relFile,
      pin.lines.length ? `:${pin.lines.join(',')}` : '',
      pin.where,
    ])
  );
}

export function conflictHead(): string[] {
  return ['LIBRARY', 'DEPENDENCY', 'PINNED', 'FILE', 'LINE', 'WHERE'];
}

/** One line per conflict naming the versions in play. */
export function conflictLines(conflicts: Conflict[]): string[] {
  return conflicts.map((conflict) => {
    const versions = conflict.versions.map(formatVersion).join(' and ');

    // "H5P.Column: H5P.Column pinned at ..." reads as nonsense. Keyed on the pin
    // rather than on the names matching, which is also true when a root merely
    // reaches a library that pins the root at two versions.
    if (conflict.pins.some((pin) => pin.where === SELF_WHERE)) {
      return `${conflict.library.machineName}: names itself at ${versions}`;
    }

    return `${conflict.library.machineName}: ${conflict.machineName} pinned at ${versions}`;
  });
}

export function inconsistencySummary(report: InconsistencyReport): string {
  const total = report.direct.length + report.transitive.length;
  const libraries = `librar${report.scanned === 1 ? 'y' : 'ies'}`;
  if (total === 0) return `scanned ${report.scanned} ${libraries} — no version inconsistencies`;
  return `scanned ${report.scanned} ${libraries} — ${total} inconsisten${total === 1 ? 'cy' : 'cies'}`;
}
