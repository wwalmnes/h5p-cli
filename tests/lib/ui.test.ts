import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ui, colorEnabled, formatRecord, renderRows, renderTable } from '../../src/lib/ui.ts';

describe('ui', () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = '';
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += chunk;
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
  });

  afterEach(() => {
    ui.progressClear();
    ui.resetLevel();
    vi.restoreAllMocks();
  });

  describe('channel routing', () => {
    it('writes human-facing levels to stderr and nothing to stdout', () => {
      ui.info('a');
      ui.step('b');
      ui.success('c');
      ui.warn('d');
      ui.error(new Error('e'));

      expect(stderr).toBe('> a\n>> b\n> c\n> d\n> error: e\n');
      expect(stdout).toBe('');
    });

    it('writes data to stdout and nothing to stderr', () => {
      ui.data('/out/h5p-blanks.h5p');

      expect(stdout).toBe('/out/h5p-blanks.h5p\n');
      expect(stderr).toBe('');
    });

    it('never prefixes or colorizes data, even with color forced on', () => {
      const previous = process.env.FORCE_COLOR;
      process.env.FORCE_COLOR = '1';
      try {
        ui.data('content/interactive-video');
        expect(stdout).toBe('content/interactive-video\n');
      } finally {
        if (previous === undefined) delete process.env.FORCE_COLOR;
        else process.env.FORCE_COLOR = previous;
      }
    });
  });

  describe('depth', () => {
    it('uses a single marker for info', () => {
      ui.info('fetching h5p library tags');
      expect(stderr).toBe('> fetching h5p library tags\n');
    });

    it('defaults step to two markers', () => {
      ui.step('updating');
      expect(stderr).toBe('>> updating\n');
    });

    it('honours an explicit depth', () => {
      ui.step('npm install', { depth: 3 });
      expect(stderr).toBe('>>> npm install\n');
    });

    it('clamps depth to at least one marker', () => {
      ui.step('x', { depth: 0 });
      expect(stderr).toBe('> x\n');
    });
  });

  describe('error normalization', () => {
    it('uses the message of an Error', () => {
      ui.error(new Error('export failed'));
      expect(stderr).toBe('> error: export failed\n');
    });

    it('passes a string through', () => {
      ui.error('something broke');
      expect(stderr).toBe('> error: something broke\n');
    });

    it('stringifies arbitrary values', () => {
      ui.error({ code: 'ENOENT' });
      expect(stderr).toBe('> error: [object Object]\n');
    });

    it('falls back to the name when an Error has an empty message', () => {
      ui.error(new RangeError(''));
      expect(stderr).toBe('> error: RangeError\n');
    });

    it('omits the stack at the normal level', () => {
      ui.setLevel('normal');
      ui.error(new Error('boom'));
      expect(stderr).toBe('> error: boom\n');
    });

    it('includes the stack when verbose', () => {
      ui.setLevel('verbose');
      ui.error(new Error('boom'));
      expect(stderr).toContain('> error: boom\n');
      expect(stderr).toContain('Error: boom\n    at ');
    });
  });

  describe('color detection', () => {
    const env = { ...process.env };

    afterEach(() => {
      process.env = { ...env };
    });

    it('is off when NO_COLOR is set', () => {
      delete process.env.FORCE_COLOR;
      process.env.NO_COLOR = '1';
      expect(colorEnabled()).toBe(false);
    });

    it('is off when FORCE_COLOR is 0, even with a TTY', () => {
      process.env.FORCE_COLOR = '0';
      expect(colorEnabled()).toBe(false);
    });

    it('is on when FORCE_COLOR is set, even without a TTY', () => {
      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = '1';
      expect(colorEnabled()).toBe(true);
    });

    it('follows the TTY when neither variable is set', () => {
      delete process.env.NO_COLOR;
      delete process.env.FORCE_COLOR;
      expect(colorEnabled()).toBe(Boolean(process.stderr.isTTY));
    });

    it('wraps the written line in an escape sequence when enabled', () => {
      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = '1';
      ui.error('boom');
      expect(stderr).toBe('\x1b[31m> error: boom\x1b[0m\n');
    });

    it('emits no escape sequences when disabled', () => {
      process.env.NO_COLOR = '1';
      delete process.env.FORCE_COLOR;
      ui.error('boom');
      expect(stderr).toBe('> error: boom\n');
    });
  });

  describe('formatRecord', () => {
    it('renders a record without writing anything', () => {
      process.env.NO_COLOR = '1';
      const rendered = formatRecord({
        kind: 'warn',
        stream: 'stderr',
        message: 'unsafe translation',
        depth: 1,
      });
      expect(rendered).toBe('> unsafe translation');
      expect(stderr).toBe('');
      delete process.env.NO_COLOR;
    });
  });

  describe('verbosity levels', () => {
    it('drops chrome but keeps warn/error/data when quiet', () => {
      ui.setLevel('quiet');

      ui.info('a');
      ui.step('b');
      ui.success('c');
      ui.debug('d');
      ui.warn('e');
      ui.error('f');
      ui.data('g');

      expect(stderr).toBe('> e\n> error: f\n');
      expect(stdout).toBe('g\n');
    });

    it('hides debug at the normal level', () => {
      ui.setLevel('normal');
      ui.debug('npm output');
      expect(stderr).toBe('');
    });

    it('shows debug when verbose', () => {
      ui.setLevel('verbose');
      ui.debug('npm output');
      expect(stderr).toBe('>>> npm output\n');
    });

    it('falls back to H5P_QUIET when no level was set', () => {
      ui.resetLevel();
      process.env.H5P_QUIET = '1';
      expect(ui.getLevel()).toBe('quiet');
      delete process.env.H5P_QUIET;
    });

    it('still honours H5P_DEBUG as a verbose alias', () => {
      ui.resetLevel();
      process.env.H5P_DEBUG = '1';
      expect(ui.getLevel()).toBe('verbose');
      delete process.env.H5P_DEBUG;
    });
  });

  describe('renderTable', () => {
    it('pads columns to the widest cell', () => {
      const lines = renderTable([
        ['h5p-accordion', 'h5p'],
        ['h5p-agamotto', 'otacke'],
      ]);
      expect(lines).toEqual([
        'h5p-accordion  h5p',
        'h5p-agamotto   otacke',
      ]);
    });

    it('lets the header widen a column', () => {
      const lines = renderTable([['ab', 'h5p']], { head: ['MACHINE NAME', 'ORG'] });
      expect(lines).toEqual([
        'MACHINE NAME  ORG',
        'ab            h5p',
      ]);
    });

    it('leaves no trailing whitespace on any line', () => {
      const lines = renderTable([
        ['long-name-here', 'h5p'],
        ['short', ''],
      ], { head: ['NAME', 'ORG'] });
      for (const line of lines) expect(line).toBe(line.trimEnd());
    });

    it('tolerates rows with missing cells', () => {
      expect(() => renderTable([['only-one']], { head: ['NAME', 'ORG'] })).not.toThrow();
      const lines = renderTable([['only-one']], { head: ['NAME', 'ORG'] });
      expect(lines[1]).toBe('only-one');
    });

    it('never truncates, unlike renderRows', () => {
      const long = 'x'.repeat(300);
      const [line] = renderTable([[long, 'h5p']]);
      expect(line.startsWith(long)).toBe(true);
      expect(line).not.toContain('…');
    });

    it('renders nothing at all for no rows, not a lone header', () => {
      expect(renderTable([], { head: ['NAME', 'ORG'] })).toEqual([]);
    });
  });

  describe('renderTable, boxed', () => {
    it('draws a grid with the header above a rule', () => {
      const lines = renderTable(
        [
          ['h5p-accordion', 'h5p'],
          ['h5p-agamotto', 'otacke'],
        ],
        { head: ['NAME', 'ORG'], box: true, width: 80 }
      );
      expect(lines).toEqual([
        '┌───────────────┬────────┐',
        '│ NAME          │ ORG    │',
        '├───────────────┼────────┤',
        '│ h5p-accordion │ h5p    │',
        '│ h5p-agamotto  │ otacke │',
        '└───────────────┴────────┘',
      ]);
    });

    it('omits the header rule when there is no header', () => {
      const lines = renderTable([['a', 'b']], { box: true, width: 80 });
      expect(lines).toEqual([
        '┌───┬───┐',
        '│ a │ b │',
        '└───┴───┘',
      ]);
    });

    it('shrinks the widest column so the box fits the terminal', () => {
      const rows = [['short', 'x'.repeat(200)]];
      for (const width of [80, 60, 30]) {
        const lines = renderTable(rows, { head: ['A', 'B'], box: true, width });
        for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
      }
    });

    it('marks a clipped cell with an ellipsis', () => {
      const [, , , row] = renderTable([['short', 'x'.repeat(200)]], {
        head: ['A', 'B'],
        box: true,
        width: 40,
      });
      expect(row).toContain('…');
    });

    it('keeps every line the same width', () => {
      const lines = renderTable(
        [
          ['a', 'much-longer-value'],
          ['bbbbbbbb', 'c'],
        ],
        { head: ['H1', 'H2'], box: true, width: 80 }
      );
      const widths = new Set(lines.map((line) => line.length));
      expect(widths.size).toBe(1);
    });

    it('stops shrinking rather than collapsing a column to nothing', () => {
      const lines = renderTable([['x'.repeat(50), 'y'.repeat(50)]], {
        box: true,
        width: 10,
      });
      // cannot fit, but must still be a well-formed box
      expect(lines[0].startsWith('┌')).toBe(true);
      expect(lines[lines.length - 1].endsWith('┘')).toBe(true);
    });
  });

  describe('ui.table', () => {
    let descriptor: PropertyDescriptor | undefined;

    beforeEach(() => {
      descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    });

    afterEach(() => {
      if (descriptor) Object.defineProperty(process.stdout, 'isTTY', descriptor);
      else delete (process.stdout as any).isTTY;
    });

    const setStdoutTTY = (value: boolean) =>
      Object.defineProperty(process.stdout, 'isTTY', { value, configurable: true });

    it('writes to stdout and nothing to stderr', () => {
      setStdoutTTY(false);
      ui.table([['a', 'b']]);
      expect(stdout).toBe('a  b\n');
      expect(stderr).toBe('');
    });

    it('shows the header when stdout is a terminal', () => {
      setStdoutTTY(true);
      ui.table([['h5p-blanks', 'h5p']], { head: ['NAME', 'ORG'] });
      expect(stdout).toContain('NAME');
    });

    it('omits the header when stdout is piped', () => {
      setStdoutTTY(false);
      ui.table([['h5p-blanks', 'h5p']], { head: ['NAME', 'ORG'] });
      expect(stdout).toBe('h5p-blanks  h5p\n');
    });

    it('survives --quiet, because a table is data', () => {
      setStdoutTTY(false);
      ui.setLevel('quiet');
      ui.table([['h5p-blanks', 'h5p']]);
      expect(stdout).toBe('h5p-blanks  h5p\n');
    });
  });

  describe('ui.list', () => {
    it('writes a title and bullets to stderr', () => {
      ui.list(['one', 'two'], { title: 'installed plugins:' });
      expect(stderr).toBe('> installed plugins:\n  - one\n  - two\n');
      expect(stdout).toBe('');
    });

    it('prints only the empty message when there is nothing to list', () => {
      ui.list([], { title: 'installed plugins:', empty: 'no plugins installed' });
      expect(stderr).toBe('> no plugins installed\n');
    });

    it('writes nothing for an empty list with no empty message', () => {
      ui.list([], { title: 'installed plugins:' });
      expect(stderr).toBe('');
    });

    it('omits the title when none is given', () => {
      ui.list(['one']);
      expect(stderr).toBe('  - one\n');
    });

    it('is suppressed by --quiet, because bullets are chrome', () => {
      ui.setLevel('quiet');
      ui.list(['one'], { title: 'installed plugins:' });
      expect(stderr).toBe('');
    });
  });

  describe('renderRows', () => {
    const opts = { width: 80, limit: 3, frame: 0 };

    it('draws an empty bar at 0%', () => {
      const [line] = renderRows([{ id: 'a', label: 'A', percent: 0 }], opts);
      expect(line).toBe('⠋ A  ░░░░░░░░░░░░░░░░    0%');
    });

    it('draws a half bar at 50%', () => {
      const [line] = renderRows([{ id: 'a', label: 'A', percent: 50 }], opts);
      expect(line).toBe('⠋ A  ████████░░░░░░░░   50%');
    });

    it('draws a full bar at 100%', () => {
      const [line] = renderRows([{ id: 'a', label: 'A', percent: 100 }], opts);
      expect(line).toBe('⠋ A  ████████████████  100%');
    });

    it('omits the bar for an indeterminate row', () => {
      const [line] = renderRows([{ id: 'a', label: 'A' }], opts);
      expect(line).toBe('⠋ A');
    });

    it('pads labels to a common width', () => {
      const lines = renderRows(
        [
          { id: 'a', label: 'short', percent: 0 },
          { id: 'b', label: 'much-longer', percent: 0 },
        ],
        opts
      );
      expect(lines[0]).toContain('short      ');
      expect(lines[1]).toContain('much-longer');
    });

    it('advances the spinner with the frame counter', () => {
      const [line] = renderRows([{ id: 'a', label: 'A' }], { ...opts, frame: 1 });
      expect(line).toBe('⠙ A');
    });

    it('collapses rows past the limit into a tail', () => {
      const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id, percent: 0 }));
      const lines = renderRows(rows, opts);
      expect(lines).toHaveLength(4);
      expect(lines[3]).toBe('  … 2 more');
    });

    it('truncates lines that would wrap', () => {
      const [line] = renderRows([{ id: 'a', label: 'A'.repeat(40), percent: 0 }], {
        ...opts,
        width: 20,
      });
      expect(line).toHaveLength(20);
      expect(line.endsWith('…')).toBe(true);
    });

    it('emits no escape sequences unless colour is requested', () => {
      const [line] = renderRows([{ id: 'a', label: 'A', percent: 0 }], opts);
      expect(line).not.toContain('\x1b[');
    });
  });

  describe('live progress area', () => {
    it('writes nothing when stderr is not a TTY', () => {
      ui.progress('a', 50, { label: 'H5P.Blanks' });
      expect(stderr).toBe('');
      ui.progressDone('a');
      expect(stderr).toBe('');
    });

    describe('on a TTY', () => {
      let descriptors: Array<[string, PropertyDescriptor | undefined]>;

      beforeEach(() => {
        descriptors = [
          ['isTTY', Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')],
          ['columns', Object.getOwnPropertyDescriptor(process.stderr, 'columns')],
        ];
        Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
        Object.defineProperty(process.stderr, 'columns', { value: 80, configurable: true });
        process.env.NO_COLOR = '1';
        delete process.env.CI;
      });

      afterEach(() => {
        ui.progressClear();
        for (const [name, descriptor] of descriptors) {
          if (descriptor) Object.defineProperty(process.stderr, name, descriptor);
          else delete (process.stderr as any)[name];
        }
        delete process.env.NO_COLOR;
      });

      it('paints a frame and hides the cursor', () => {
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        expect(stderr).toContain('\x1b[?25l');
        expect(stderr).toContain('⠋ H5P.Blanks  ████████░░░░░░░░   50%');
      });

      it('clears the frame, writes the log line, then repaints', () => {
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        stderr = '';

        ui.info('fetching registry');

        const clearAt = stderr.indexOf('\x1b[0J');
        const lineAt = stderr.indexOf('> fetching registry');
        const repaintAt = stderr.indexOf('H5P.Blanks');
        expect(clearAt).toBeGreaterThanOrEqual(0);
        expect(lineAt).toBeGreaterThan(clearAt);
        expect(repaintAt).toBeGreaterThan(lineAt);
      });

      it('brackets stdout writes too, since both share the terminal', () => {
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        stderr = '';

        ui.data('content/foo');

        expect(stdout).toBe('content/foo\n');
        expect(stderr).toContain('\x1b[0J');
        expect(stderr).toContain('H5P.Blanks');
      });

      it('keeps the area alive while other rows remain', () => {
        ui.progress('a', 10, { label: 'first' });
        ui.progress('b', 20, { label: 'second' });
        stderr = '';

        ui.progressDone('a');

        expect(stderr).toContain('second');
        expect(stderr).not.toContain('first');
        expect(stderr).not.toContain('\x1b[?25h');
      });

      it('clears the area and restores the cursor on the last row', () => {
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        stderr = '';

        ui.progressDone('a');

        expect(stderr).toContain('\x1b[0J');
        expect(stderr).toContain('\x1b[?25h');
        expect(stderr).not.toContain('H5P.Blanks');
      });

      it('reuses the stored label when a later call omits it', () => {
        ui.progress('a', 10, { label: 'H5P.Blanks' });
        stderr = '';
        ui.progress('a', 90);
        expect(stderr).toContain('H5P.Blanks');
        expect(stderr).toContain('90%');
      });

      it('is silent when quiet, even on a TTY', () => {
        ui.setLevel('quiet');
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        expect(stderr).toBe('');
      });

      it('is silent under CI', () => {
        process.env.CI = '1';
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        expect(stderr).toBe('');
        delete process.env.CI;
      });

      it('drops every row on progressClear', () => {
        ui.progress('a', 10, { label: 'first' });
        ui.progress('b', 20, { label: 'second' });
        stderr = '';

        ui.progressClear();

        expect(stderr).toContain('\x1b[?25h');
        ui.info('after');
        expect(stderr).not.toContain('first');
        expect(stderr).not.toContain('second');
      });

      it('clears the area before reporting an error', () => {
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        stderr = '';

        ui.error(new Error('boom'));

        expect(stderr).toContain('> error: boom');
        expect(stderr).not.toContain('H5P.Blanks');
      });

      describe('status lines', () => {
        it('draws the message as a row and commits no line', () => {
          ui.status('deps', 'on level 1');

          expect(stderr).toContain('⠋ on level 1');
          expect(stderr).not.toContain('>>> on level 1');
        });

        it('replaces the text instead of adding a row', () => {
          ui.status('deps', 'first message');
          stderr = '';

          ui.status('deps', 'second message');

          expect(stderr).toContain('second message');
          expect(stderr).not.toContain('first message');
        });

        it('also writes a scroll-back line when verbose', () => {
          ui.setLevel('verbose');
          ui.status('deps', 'on level 1');

          expect(stderr).toContain('>>> on level 1');
          expect(stderr).toContain('⠋ on level 1');
        });

        it('keeps an interleaved log line above an intact row', () => {
          ui.status('deps', 'resolving');
          stderr = '';

          ui.warn('library not found in registry');

          const clearAt = stderr.indexOf('\x1b[0J');
          const lineAt = stderr.indexOf('> library not found in registry');
          const repaintAt = stderr.indexOf('⠋ resolving');
          expect(clearAt).toBeGreaterThanOrEqual(0);
          expect(lineAt).toBeGreaterThan(clearAt);
          expect(repaintAt).toBeGreaterThan(lineAt);
        });

        it('clears the line and restores the cursor when done', () => {
          ui.status('deps', 'resolving');
          stderr = '';

          ui.statusDone('deps');

          expect(stderr).toContain('\x1b[0J');
          expect(stderr).toContain('\x1b[?25h');
          expect(stderr).not.toContain('resolving');
        });
      });
    });

    describe('status lines without a TTY', () => {
      it('write nothing at the normal level', () => {
        ui.setLevel('normal');
        ui.status('deps', 'on level 1');
        ui.statusDone('deps');
        expect(stderr).toBe('');
      });

      it('write a plain debug line when verbose', () => {
        ui.setLevel('verbose');
        ui.status('deps', 'on level 1');
        ui.statusDone('deps');
        expect(stderr).toBe('>>> on level 1\n');
      });
    });
  });
});
