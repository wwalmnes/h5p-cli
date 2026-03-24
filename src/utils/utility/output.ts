const lf = '\u000A';
const cr = '\u000D';
export const color = {
  default: '\x1B[0m',
  emphasize: '\x1B[1m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  red: '\x1B[31m',
  blue: '\x1B[34m'
};

const noCr = (process.platform === 'win32');

export interface Repo {
  name?: string;
  failed?: boolean;
  skipped?: boolean;
  msg?: any;
  branch?: string;
  error?: any;
  changes?: string[];
  commit?: string;
}

export function emphasizeExpressions(strings: TemplateStringsArray, ...expressions: any[]): string {
  let emphasizedString = '';
  expressions.forEach((expression, index) => {
    emphasizedString +=
      `${strings[index]} \'${color.emphasize}${expression}${color.default}\'`
  });
  emphasizedString += strings[strings.length - 1];
  return emphasizedString;
}

/**
 * Simple class for displaying a spinner while we're working.
 */
export function Spinner(this: any, prefix: string) {
  let interval: ReturnType<typeof setInterval>;

  if (noCr) {
    this.stop = function (result: string) {
      clearInterval(interval);
      process.stdout.write(' ' + result);
    };

    process.stdout.write(prefix);
    interval = setInterval(function () {
      process.stdout.write('.');
    }, 500);
  }
  else {
    const parts = ['/','-','\\', '|'];
    let curPos = 0;
    const maxPos = parts.length;

    this.stop = function (result: string) {
      clearInterval(interval);
      process.stdout.write(cr + prefix + ' ' + result);
    };

    interval = setInterval(function () {
      out(cr + prefix + ' ' + color.emphasize + parts[curPos++] + color.default);
      if (curPos === maxPos) curPos = 0;
    }, 100);
  }

  this.failed = function (error: string) {
    this.stop(`${getFailedMsg()} ${lf} ${error}`);
  };

  this.succeeded = function (result?: string) {
    this.stop(`${getOkMsg()}${result ? ' ' + result : ''}${lf}`);
  };
}

function out(message: string): void {
  process.stdout.write(message);
}

function getFailedMsg(): string {
  return `${color.red}FAILED${color.default}`;
}

function getSkippedMsg(): string {
  return `${color.yellow}SKIPPED${color.default}`;
}

function getOkMsg(): string {
  return `${color.green}OK${color.default}`;
}

function outputResult(repo: Repo): void {
  outputRepo(repo);

  if (repo.failed) {
    out(` ${getFailedMsg()}`);
  }
  else if (repo.skipped) {
    out(` ${getSkippedMsg()}`);
  }
  else {
    out(` ${getOkMsg()}`);
  }

  if (repo.msg) {
    out(' ' + repo.msg);
  }

  out(lf);
}

function outputRepo(repo: Repo): void {
  if (repo.name) {
    out(color.emphasize + repo.name + color.default);
  }
}

export const printResults = function (repositories: Repo | Repo[]): void {
  if (!repositories) return;

  if (repositories instanceof Array) {
    repositories.forEach(function (repo) {
      outputResult(repo);
    });
  }
  else if (repositories instanceof Object) {
    outputResult(repositories);
  }
};

export const printStatus = function (repo: Repo): void {
  outputRepo(repo);
  if (repo.branch) {
    out(' (' + repo.branch + ')');
  }
  out(lf);

  if (repo.error) {
    out(repo.error + lf);
  }
  else if (repo.changes !== undefined) {
    out(repo.changes.join(lf) + lf);
  }
};

export const printPulled = function (repo: Repo | Repo[] | null | undefined): void {
  if (!repo) {
    return;
  }

  if (Array.isArray(repo)) {
    sortLexically(repo);
    repo.forEach(singleRepo => {
      printPulled(singleRepo);
    });
    printLn('');
    printPulledSummary(repo);
    return;
  }

  outputRepo(repo);

  if (repo.error) {
    out(` ${getFailedMsg() + lf + repo.msg}`);
  }
  else {
    out(` ${getOkMsg()} ${repo.msg}`);
  }
};

const sortLexically = (repos: Repo[]): void => {
  repos.sort((a, b) => {
    if ((a.name || '') > (b.name || '')) {
      return -1;
    }
    else if ((a.name || '') < (b.name || '')) {
      return 1;
    }
    else {
      return 0;
    }
  });
};

const printPulledSummary = (repos: Repo[]): void => {
  const summary = summarizeRepos(repos);

  out(`Finished processing ${summary.total} repositories${lf}`);

  if (summary.upToDate) {
    out(`${summary.upToDate} ${repoPlural(summary.upToDate)} already up to date.${lf}`);
  }

  if (summary.updated) {
    out(`${summary.updated} ${repoPlural(summary.updated)} updated.${lf}`);
  }

  if (summary.failed) {
    out(`${summary.failed} ${repoPlural(summary.failed)} failed.${lf}`);
  }
};

const summarizeRepos = (repos: Repo[]): any => {
  const summary = repos.reduce((prev: any, curr: Repo) => {
    if (curr.error) {
      prev.failed = prev.failed ? prev.failed + 1 : 1;
    }
    else if (curr.msg && curr.msg.includes('Already up-to-date')) {
      prev.upToDate = prev.upToDate ? prev.upToDate + 1 : 1;
    }
    else {
      prev.updated = prev.updated ? prev.updated + 1 : 1;
    }

    return prev;
  }, {});
  summary.total = repos.length;

  return summary;
};

const repoPlural = (numRepos: number): string => {
  return numRepos === 1 ? 'repository' : 'repositories';
};

export const printError = function (error: string): void {
  out(error + lf);
};

export const printLn = function (text?: string): void {
  text = text || '';
  out(text + lf);
};
