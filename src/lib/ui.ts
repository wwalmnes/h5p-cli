import chalk from 'chalk';
import ora, { Ora } from 'ora';

export { chalk };

export const ui = {
  error:   (msg: string) => chalk.red(`> error: ${msg}`),
  warn:    (msg: string) => chalk.yellow(`!!! ${msg}`),
  heading: (msg: string) => chalk.bold(`>>> ${msg}`),
};

export interface SpinnerHandle {
  log:     (msg: string) => void;
  succeed: (msg?: string) => void;
  fail:    (msg?: string) => void;
  warn:    (msg?: string) => void;
  stop:    () => void;
}

export function startSpinner(text: string): SpinnerHandle {
  const spinner: Ora = ora(text).start();
  return {
    log:     (msg) => { spinner.clear(); process.stdout.write(msg + '\n'); spinner.render(); },
    succeed: (msg) => spinner.succeed(msg ? chalk.green(msg) : undefined),
    fail:    (msg) => spinner.fail(msg ? chalk.red(msg) : undefined),
    warn:    (msg) => spinner.warn(msg ? chalk.yellow(msg) : undefined),
    stop:    ()    => spinner.stop(),
  };
}
