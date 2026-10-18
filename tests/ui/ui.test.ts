import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ui, colorEnabled, renderRows, renderTable } from '../../src/ui/ui.ts';

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

  describe('error normalization', () => {
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

  describe('fail', () => {
    afterEach(() => {
      // A leaked code would fail the whole Vitest run, not just this file.
      process.exitCode = 0;
    });

    it('reports the error and sets a non-zero exit code', () => {
      process.exitCode = 0;
      ui.fail(new Error('install failed'));
      expect(stderr).toBe('> error: install failed\n');
      expect(process.exitCode).toBe(1);
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

    it('shows debug only when verbose', () => {
      ui.setLevel('normal');
      ui.debug('npm output');
      expect(stderr).toBe('');

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

    it('shrinks the widest column so the box fits the terminal', () => {
      const rows = [['short', 'x'.repeat(200)]];
      for (const width of [80, 60, 30]) {
        const lines = renderTable(rows, { head: ['A', 'B'], box: true, width });
        for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
      }
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

    it('shows the header when stdout is a terminal', () => {
      setStdoutTTY(true);
      ui.table([['h5p-blanks', 'h5p']], { head: ['NAME', 'ORG'] });
      expect(stdout).toContain('NAME');
    });

    it('writes bare columns to stdout, without the header, when piped', () => {
      setStdoutTTY(false);
      ui.table([['h5p-blanks', 'h5p']], { head: ['NAME', 'ORG'] });
      expect(stdout).toBe('h5p-blanks  h5p\n');
      expect(stderr).toBe('');
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

    it('is suppressed by --quiet, because bullets are chrome', () => {
      ui.setLevel('quiet');
      ui.list(['one'], { title: 'installed plugins:' });
      expect(stderr).toBe('');
    });
  });

  describe('renderRows', () => {
    const opts = { width: 80, limit: 3, frame: 0 };

    it('draws a half bar at 50%', () => {
      const [line] = renderRows([{ id: 'a', label: 'A', percent: 50 }], opts);
      expect(line).toBe('⠋ A  ████████░░░░░░░░   50%');
    });

    it('omits the bar for an indeterminate row', () => {
      const [line] = renderRows([{ id: 'a', label: 'A' }], opts);
      expect(line).toBe('⠋ A');
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

    describe('stall indicator', () => {
      const started = { id: 'a', label: 'A', percent: 0, startedAt: 1_000_000 };

      it('stays quiet while a row is still young', () => {
        const [line] = renderRows([started], { ...opts, now: started.startedAt + 19_000 });
        expect(line).toBe('⠋ A  ░░░░░░░░░░░░░░░░    0%');
      });

      it('reports the age once a row has been silent too long', () => {
        const [line] = renderRows([started], { ...opts, now: started.startedAt + 25_000 });
        expect(line).toBe('⠋ A  ░░░░░░░░░░░░░░░░    0%  25s');
      });
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

      it('writes the log line over the frame, then repaints', () => {
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        stderr = '';

        ui.info('fetching registry');

        const rewindAt = stderr.indexOf('\x1b[1A');
        const lineAt = stderr.indexOf('> fetching registry');
        const repaintAt = stderr.indexOf('H5P.Blanks');
        expect(rewindAt).toBeGreaterThanOrEqual(0);
        expect(lineAt).toBeGreaterThan(rewindAt);
        expect(repaintAt).toBeGreaterThan(lineAt);
      });

      it('redraws over the old frame in a single write, erasing only leftovers', () => {
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        const write = vi.mocked(process.stderr.write);
        write.mockClear();

        ui.progress('a', 75);

        expect(write).toHaveBeenCalledTimes(1);
        const [chunk] = write.mock.calls[0] as [string];
        const frameAt = chunk.indexOf('H5P.Blanks');
        expect(frameAt).toBeGreaterThan(chunk.indexOf('\x1b[1A'));
        // nothing is erased before the new frame is drawn
        expect(chunk.indexOf('\x1b[0J')).toBeGreaterThan(frameAt);
        expect(chunk).toContain('\x1b[K\n');
      });

      it('writes plain lines when no frame is on screen', () => {
        ui.info('fetching registry');
        expect(stderr).toBe('> fetching registry\n');
      });

      it('clears the area and restores the cursor on the last row', () => {
        ui.progress('a', 50, { label: 'H5P.Blanks' });
        stderr = '';

        ui.progressDone('a');

        expect(stderr).toContain('\x1b[0J');
        expect(stderr).toContain('\x1b[?25h');
        expect(stderr).not.toContain('H5P.Blanks');
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

      it('replaces a status line\'s text instead of adding a row', () => {
        ui.status('deps', 'first message');
        stderr = '';

        ui.status('deps', 'second message');

        expect(stderr).toContain('second message');
        expect(stderr).not.toContain('first message');
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
