import { cursorTo, moveCursor, clearScreenDown } from 'node:readline';

/** Severity of a single record. */
export type UiKind = 'info' | 'step' | 'success' | 'warn' | 'error' | 'data' | 'debug' | 'list';

/** How much of it the user wants to see. */
export type UiLevel = 'quiet' | 'normal' | 'verbose';

export type UiRecord = {
  kind: UiKind;
  stream: 'stdout' | 'stderr';
  /** Uncolored, unprefixed text. Color and prefixes are applied when rendered. */
  message: string;
  depth?: number;
  /** Populated by error() when running verbose. */
  detail?: string;
};

const RESET = '\x1b[0m';
const CODES = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
} as const;

type ColorName = keyof typeof CODES;

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

// ---------------------------------------------------------------- verbosity

/** Kinds that survive `quiet`. Everything else is chrome. */
const ALWAYS: ReadonlySet<UiKind> = new Set<UiKind>(['warn', 'error', 'data']);

function levelFromEnv(): UiLevel {
  if (process.env.H5P_VERBOSE || process.env.H5P_DEBUG) return 'verbose';
  if (process.env.H5P_QUIET) return 'quiet';
  return 'normal';
}

let level: UiLevel | undefined;

export function getLevel(): UiLevel {
  // Resolved lazily so env changes before the first write are still honoured.
  return level ?? levelFromEnv();
}

export function setLevel(next: UiLevel): void {
  level = next;
}

/** Test seam only in the sense that it forgets an explicit setLevel(). */
export function resetLevel(): void {
  level = undefined;
}

function passesLevel(kind: UiKind): boolean {
  const current = getLevel();
  if (kind === 'debug') return current === 'verbose';
  if (current === 'quiet') return ALWAYS.has(kind);
  return true;
}

// -------------------------------------------------------------------- color

/**
 * Read fresh on every call rather than cached at import time, so tests (and
 * anything that reassigns the env mid-run) see the change.
 */
export function colorEnabled(): boolean {
  const force = process.env.FORCE_COLOR;
  if (force === '0') return false;
  if (force !== undefined && force !== '') return true;
  if (process.env.NO_COLOR !== undefined) return false;
  return Boolean(process.stderr.isTTY);
}

function paint(text: string, color: ColorName): string {
  return colorEnabled() ? `${CODES[color]}${text}${RESET}` : text;
}

const KIND_COLOR: Partial<Record<UiKind, ColorName>> = {
  success: 'green',
  warn: 'yellow',
  error: 'red',
  debug: 'dim',
};

/** ">" for depth 1, ">>" for 2, and so on. */
function prefix(depth: number): string {
  return '>'.repeat(Math.max(1, depth));
}

/** Renders a record the way it appears on a terminal. */
export function formatRecord(record: UiRecord): string {
  if (record.kind === 'data') return record.message;
  // verbatim stderr line — the caller owns the bullet or the box border
  if (record.kind === 'list') return record.message;

  const line = `${prefix(record.depth ?? 1)} ${record.message}`;
  const color = KIND_COLOR[record.kind];
  return color ? paint(line, color) : line;
}

// ------------------------------------------------------------------- tables

const BOX = {
  topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘',
  horizontal: '─', vertical: '│',
  teeDown: '┬', teeUp: '┴', teeRight: '├', teeLeft: '┤', cross: '┼',
} as const;

/** Narrowest a column may be squeezed to before we stop shrinking it. */
const MIN_COLUMN = 4;

export type TableLayout = {
  head?: string[];
  /** Draw box-drawing borders. Callers gate this on isTTY. */
  box?: boolean;
  /** Terminal width the box must fit inside. Ignored when box is false. */
  width?: number;
};

function columnWidths(all: string[][], columns: number): number[] {
  return Array.from({ length: columns }, (_, i) =>
    Math.max(...all.map((row) => (row[i] ?? '').length))
  );
}

/** `│ a │ b │` costs one space either side of each cell plus the verticals. */
function boxedWidth(widths: number[]): number {
  return widths.reduce((sum, w) => sum + w, 0) + 3 * widths.length + 1;
}

/**
 * Squeeze the widest column repeatedly until the box fits. Only the boxed
 * (terminal) rendering ever clips — piped output goes through the unboxed
 * path, so nothing a script consumes is ever truncated.
 */
function shrinkToFit(widths: number[], width: number): void {
  while (boxedWidth(widths) > width) {
    let widest = 0;
    for (let i = 1; i < widths.length; i++) {
      if (widths[i] > widths[widest]) widest = i;
    }
    if (widths[widest] <= MIN_COLUMN) return; // cannot squeeze any further
    widths[widest] -= 1;
  }
}

function rule(widths: number[], left: string, mid: string, right: string): string {
  return left + widths.map((w) => BOX.horizontal.repeat(w + 2)).join(mid) + right;
}

function boxRow(cells: string[], widths: number[]): string {
  const padded = widths.map((w, i) => truncate(cells[i] ?? '', w).padEnd(w));
  return `${BOX.vertical} ${padded.join(` ${BOX.vertical} `)} ${BOX.vertical}`;
}

/**
 * Lays out aligned columns. Pure, so the layout is testable without a terminal.
 *
 * The plain (unboxed) form is deliberately unlike renderRows: it is *data*, so
 * cells are never truncated — clipping would corrupt what the user piped out —
 * and the last column is never padded, to avoid trailing whitespace.
 */
export function renderTable(rows: string[][], options: TableLayout = {}): string[] {
  if (rows.length === 0) return [];

  const { head, box, width } = options;
  const all = head ? [head, ...rows] : rows;
  const columns = Math.max(...all.map((row) => row.length));
  const widths = columnWidths(all, columns);

  if (!box) {
    return all.map((row) =>
      Array.from({ length: columns }, (_, i) => row[i] ?? '')
        // padding the final column would only add trailing whitespace
        .map((cell, i) => (i === columns - 1 ? cell : cell.padEnd(widths[i])))
        .join('  ')
        .trimEnd()
    );
  }

  if (width && width > 0) shrinkToFit(widths, width);

  const lines = [rule(widths, BOX.topLeft, BOX.teeDown, BOX.topRight)];
  if (head) {
    lines.push(boxRow(head, widths));
    lines.push(rule(widths, BOX.teeRight, BOX.cross, BOX.teeLeft));
  }
  for (const row of rows) lines.push(boxRow(row, widths));
  lines.push(rule(widths, BOX.bottomLeft, BOX.teeUp, BOX.bottomRight));
  return lines;
}

// ------------------------------------------------------------- progress rows

export type ProgressRow = {
  id: string;
  label: string;
  /** undefined means indeterminate — spinner, no bar. */
  percent?: number;
};

export type RenderOptions = {
  width: number;
  limit: number;
  /** Index into SPINNER; the caller advances it. */
  frame: number;
  /** Escape sequences are omitted when false, which keeps tests readable. */
  color?: boolean;
};

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;
const BAR_WIDTH = 16;
const BAR_FULL = '█';
const BAR_EMPTY = '░';

function clamp(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

function truncate(line: string, width: number): string {
  return line.length > width ? line.slice(0, Math.max(0, width - 1)) + '…' : line;
}

/**
 * Pure frame construction — no I/O, no state. All layout coverage lives on
 * this function, which is why it is exported.
 */
export function renderRows(rows: ProgressRow[], options: RenderOptions): string[] {
  const { width, limit, frame } = options;
  const useColor = options.color ?? false;
  const tint = (text: string, color: ColorName) =>
    useColor ? `${CODES[color]}${text}${RESET}` : text;

  const visible = rows.slice(0, Math.max(0, limit));
  const labelWidth = Math.max(0, ...visible.map((row) => row.label.length));
  const spinner = SPINNER[frame % SPINNER.length];

  const lines = visible.map((row) => {
    const label = row.label.padEnd(labelWidth);
    if (row.percent === undefined) {
      return truncate(`${tint(spinner, 'cyan')} ${label}`, width);
    }
    const percent = clamp(row.percent);
    const filled = Math.round((percent / 100) * BAR_WIDTH);
    const bar = BAR_FULL.repeat(filled) + BAR_EMPTY.repeat(BAR_WIDTH - filled);
    const value = `${Math.round(percent)}`.padStart(3);
    return truncate(`${tint(spinner, 'cyan')} ${label}  ${bar}  ${value}%`, width);
  });

  const hidden = rows.length - visible.length;
  if (hidden > 0) {
    lines.push(truncate(`  ${tint(`… ${hidden} more`, 'dim')}`, width));
  }
  return lines;
}

// --------------------------------------------------------------- live region

const REPAINT_MS = 80;
const DEFAULT_LIMIT = 3;

const rows = new Map<string, ProgressRow>();
let limit = DEFAULT_LIMIT;
let paintedLines = 0;
let frame = 0;
let timer: NodeJS.Timeout | undefined;
let cursorHidden = false;
let exitHooked = false;

/**
 * Animation is off when there is no terminal to animate, when the user asked
 * for quiet, or under CI — where escape sequences only pollute the log.
 */
function liveEnabled(): boolean {
  if (process.env.CI) return false;
  if (getLevel() === 'quiet') return false;
  return Boolean(process.stderr.isTTY);
}

function terminalWidth(): number {
  return (process.stderr.columns ?? 80) - 1;
}

/** Erase the current frame, leaving the cursor where the frame began. */
function clearRegion(): void {
  if (paintedLines === 0) return;
  moveCursor(process.stderr, 0, -paintedLines);
  cursorTo(process.stderr, 0);
  clearScreenDown(process.stderr);
  paintedLines = 0;
}

function paintRegion(): void {
  if (!liveEnabled() || rows.size === 0) return;

  const lines = renderRows([...rows.values()], {
    width: terminalWidth(),
    limit,
    frame,
    color: colorEnabled(),
  });
  if (lines.length === 0) return;

  process.stderr.write(`${lines.join('\n')}\n`);
  paintedLines = lines.length;
}

function hideCursor(): void {
  if (cursorHidden || !liveEnabled()) return;
  process.stderr.write(HIDE_CURSOR);
  cursorHidden = true;
}

function showCursor(): void {
  if (!cursorHidden) return;
  process.stderr.write(SHOW_CURSOR);
  cursorHidden = false;
}

/**
 * A frame left on screen at exit is bad; an invisible cursor left behind is
 * worse — the user's shell stays broken until they run `reset`.
 */
function hookExit(): void {
  if (exitHooked) return;
  exitHooked = true;
  process.on('exit', () => {
    clearRegion();
    showCursor();
  });
  process.once('SIGINT', () => {
    clearRegion();
    showCursor();
    process.exit(130);
  });
}

function startTimer(): void {
  if (timer || !liveEnabled()) return;
  timer = setInterval(() => {
    frame += 1;
    clearRegion();
    paintRegion();
  }, REPAINT_MS);
  // Never keep the process alive just to spin.
  timer.unref();
}

function stopTimer(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = undefined;
}

function teardown(): void {
  stopTimer();
  clearRegion();
  showCursor();
}

// --------------------------------------------------------------------- emit

let epipeHooked = false;

/**
 * `console.log` quietly swallows stream errors; a bare stream.write() does not,
 * so without this `h5p list | head` dies with an unhandled EPIPE stack trace
 * once the reader goes away. Exit quietly instead, the way a shell tool should.
 *
 * The error arrives asynchronously, so a try/catch around the write cannot
 * catch it — it has to be a listener.
 */
function hookBrokenPipe(): void {
  if (epipeHooked) return;
  epipeHooked = true;
  for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (error: NodeJS.ErrnoException) => {
      if (error?.code === 'EPIPE') process.exit(0);
      throw error;
    });
  }
}

/**
 * The single point where anything reaches a stream. The live region wraps the
 * write so a log line lands in scrollback above an intact frame — which is why
 * the ui.* helpers must never call stream.write() themselves.
 *
 * The clear/repaint brackets *every* record, stdout included: both streams
 * usually point at the same terminal, so a stdout write during a live stderr
 * frame corrupts it just the same.
 */
function emit(record: UiRecord): void {
  if (!passesLevel(record.kind)) return;

  hookBrokenPipe();
  clearRegion();

  const stream = record.stream === 'stdout' ? process.stdout : process.stderr;
  stream.write(`${formatRecord(record)}\n`);
  if (record.detail) {
    stream.write(`${paint(record.detail, 'dim')}\n`);
  }

  paintRegion();
}

/** Turns an unknown thrown value into a human-readable message. */
function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack };
  }
  if (typeof error === 'string') return { message: error };
  try {
    return { message: String(error) };
  } catch {
    return { message: 'unknown error' };
  }
}

export type StepOptions = {
  depth?: number;
};

export type ProgressOptions = {
  label?: string;
};

export type ListOptions = {
  /** Printed above the bullets. */
  title?: string;
  /** Printed instead of the bullets when there is nothing to list. */
  empty?: string;
};

/**
 * `ui.table` callers pick the headings only; `box` and `width` are derived from
 * TTY state inside `table()`, so they are deliberately not exposed here.
 */
export type TableOptions = Pick<TableLayout, 'head'>;

export const ui = {
  setLevel,
  getLevel,
  resetLevel,

  info(message: string): void {
    emit({ kind: 'info', stream: 'stderr', message, depth: 1 });
  },

  step(message: string, options: StepOptions = {}): void {
    emit({ kind: 'step', stream: 'stderr', message, depth: options.depth ?? 2 });
  },

  success(message: string): void {
    emit({ kind: 'success', stream: 'stderr', message, depth: 1 });
  },

  warn(message: string): void {
    emit({ kind: 'warn', stream: 'stderr', message, depth: 1 });
  },

  /** Subprocess output and other noise. Hidden unless running verbose. */
  debug(message: string, options: StepOptions = {}): void {
    emit({ kind: 'debug', stream: 'stderr', message, depth: options.depth ?? 3 });
  },

  /**
   * Replaces the `console.log('> error'); console.log(error)` pair. The stack
   * is noise for CLI users, so it only appears when running verbose.
   */
  error(error: unknown): void {
    // Never strand a half-drawn frame above an error message.
    ui.progressClear();
    const { message, stack } = normalizeError(error);
    emit({
      kind: 'error',
      stream: 'stderr',
      message: `error: ${message}`,
      depth: 1,
      detail: getLevel() === 'verbose' ? stack : undefined,
    });
  },

  /**
   * `error()`, plus the exit code that makes a failure visible to a shell.
   *
   * Commander resolves an action handler's promise whether or not the body
   * threw, so a handler that only reports the error still leaves the process
   * at 0 and `h5p install X && next` runs `next` after a failed install.
   * Setting `exitCode` rather than calling `process.exit()` lets the event
   * loop drain, so buffered stderr is not truncated on the way out.
   */
  fail(error: unknown): void {
    ui.error(error);
    process.exitCode = 1;
  },

  /** The pipe-safe channel: raw value on stdout, no prefix, no color. */
  data(value: string): void {
    emit({ kind: 'data', stream: 'stdout', message: value });
  },

  /**
   * Bulleted lines on stderr — annotation, not data. Renders as
   * `> title` followed by `  - item` lines. Suppressed by --quiet.
   */
  list(items: string[], options: ListOptions = {}): void {
    if (items.length === 0) {
      if (options.empty) ui.info(options.empty);
      return;
    }

    // A boxed list is just a one-column table whose header is the title.
    if (process.stderr.isTTY) {
      const lines = renderTable(items.map((item) => [`- ${item}`]), {
        head: options.title ? [options.title] : undefined,
        box: true,
        width: process.stderr.columns,
      });
      for (const line of lines) {
        emit({ kind: 'list', stream: 'stderr', message: line });
      }
      return;
    }

    if (options.title) ui.info(options.title);
    for (const item of items) {
      emit({ kind: 'list', stream: 'stderr', message: `  - ${item}` });
    }
  },

  /**
   * Aligned columns on stdout. This is data, so it survives --quiet, is never
   * colored, and is never truncated.
   *
   * `head` is shown only when stdout is a terminal — note stdout, not the
   * stderr that colorEnabled()/liveEnabled() test, since that is where the
   * table lands. Pipelines therefore get bare rows.
   */
  table(rows: string[][], options: TableOptions = {}): void {
    const box = Boolean(process.stdout.isTTY);
    const lines = renderTable(rows, {
      head: box ? options.head : undefined,
      box,
      width: process.stdout.columns,
    });
    for (const line of lines) {
      ui.data(line);
    }
  },

  /**
   * Create or update a progress row. `percent` is whatever the caller says it
   * is — omit it for an indeterminate spinner. Silent when there is no
   * terminal to draw on, so CI logs are unaffected.
   */
  progress(id: string, percent?: number, options: ProgressOptions = {}): void {
    const existing = rows.get(id);
    rows.set(id, {
      id,
      label: options.label ?? existing?.label ?? id,
      percent: percent === undefined ? undefined : clamp(percent),
    });

    if (!liveEnabled()) return;
    hookExit();
    hideCursor();
    startTimer();
    clearRegion();
    paintRegion();
  },

  /** Retire a row and free its slot. The row vanishes; no line is committed. */
  progressDone(id: string): void {
    if (!rows.delete(id)) return;
    if (!liveEnabled()) return;

    clearRegion();
    if (rows.size === 0) teardown();
    else paintRegion();
  },

  /**
   * A transient line that overwrites itself: one live row whose text is
   * replaced on every call, for detail that matters while it happens and not
   * afterwards. Commit a permanent summary with ui.info() once done.
   *
   * Unlike progress(), this also passes the message to ui.debug() — which
   * self-gates on the level — so the detail is still reachable when there is
   * no terminal to draw on:
   *
   *            normal                 verbose
   *   TTY      live row               live row + >>> in scroll-back
   *   piped    nothing                >>> only
   */
  status(id: string, message: string): void {
    ui.debug(message);
    ui.progress(id, undefined, { label: message });
  },

  /** Retire a status row. The line vanishes; print your own summary. */
  statusDone(id: string): void {
    ui.progressDone(id);
  },

  /** Drop every row at once — error and teardown paths. */
  progressClear(): void {
    if (rows.size === 0) return;
    rows.clear();
    teardown();
  },

  /** How many rows the live area shows before collapsing into "… N more". */
  setProgressLimit(count: number): void {
    limit = Math.max(1, count);
  },
};
