export type Version = {
  major: number;
  minor: number;
};

/** A full semantic version: `Version` plus the patch component. */
export type SemVer = Version & { patch: number };

export function parseVersion(input: string, label: string): Version {
  const match = /^(\d+)\.(\d+)$/.exec(String(input).trim());
  if (!match) {
    throw new Error(`Invalid ${label} version "${input}" — expected <major>.<minor>, e.g. 1.0`);
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/** One `<machineName>` or `<machineName>@<from>..<to>` command-line argument. */
export type SeedArg = {
  machineName: string;
  from?: Version;
  to?: Version;
};

export function parseSeedArg(input: string): SeedArg {
  const text = String(input).trim();
  const at = text.indexOf('@');
  if (at === -1) return { machineName: text };

  const machineName = text.slice(0, at);
  const range = text.slice(at + 1);

  if (!machineName) {
    throw new Error(`Invalid library "${input}" — expected a machine name before the @`);
  }

  const parts = range.split('..');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid version range "${range}" in "${input}" — expected <machineName>@<from>..<to>, e.g. ${machineName}@1.0..1.2`,
    );
  }

  return {
    machineName,
    from: parseVersion(parts[0], `from version of ${machineName}`),
    to: parseVersion(parts[1], `to version of ${machineName}`),
  };
}

export function formatVersion(version: Version): string {
  return `${version.major}.${version.minor}`;
}

export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  return a.minor - b.minor;
}

export function sameVersion(a: Version, b: Version): boolean {
  return compareVersions(a, b) === 0;
}

export function bumpMinor(version: Version): Version {
  return { major: version.major, minor: version.minor + 1 };
}
