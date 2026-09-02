import { ui } from './ui.ts';
import type { Logger } from './repo-types.ts';

/**
 * The default sink for services that accept a `Logger`.
 *
 * These services predate `ui` and encode their channel in the message itself:
 * a `>` run is chrome the user reads, `!!!` is a warning, and an unprefixed
 * line is a list entry that used to land on stdout for piping. Routing on that
 * prefix keeps every existing call site on the stream it already used, so the
 * only thing that changes is that the output now respects --quiet/--verbose
 * and no longer shreds the live progress frame.
 *
 * The `>` run is stripped because `ui` applies its own depth prefix; leaving it
 * would print `> > done setting up core libraries`.
 */
export const uiLogger: Logger = {
  log: (...args: any[]) => {
    const message = args.map(String).join(' ');

    const warning = message.match(/^!!!\s*(.*)$/s);
    if (warning) {
      ui.warn(warning[1]);
      return;
    }

    const chrome = message.match(/^(>+)\s*(.*)$/s);
    if (chrome) {
      // '>>' and deeper are sub-steps; a single '>' is a top-level line.
      if (chrome[1].length > 1) ui.step(chrome[2]);
      else ui.info(chrome[2]);
      return;
    }

    // Unprefixed lines are the list entries a script pipes out.
    ui.data(message);
  },
};
