import { ui } from './src/lib/ui.ts';

export type Version = {
  major: number;
  minor: number;
};

/** Map of major -> minor -> upgrade function, as declared in a library's upgrades.js */
export type UpgradeFunctions = Record<string, Record<string, Function>>;

export type UpgradeInput = {
  /** Versioned name, e.g. "H5P.Accordion 1.0" */
  library: string;
  params: any;
  metadata?: any;
};

export type UpgradeResult = {
  library: string;
  params: any;
  metadata: any;
};

/**
 * The upgrade functions come from arbitrary content types' `upgrades.js`, so the
 * parameter trees this file walks have no shape we can know ahead of time. The
 * internals are consequently `any`; only the exported surface is typed.
 */

/**
 * Upgrades content parameters to the latest version using the provided upgrade script.
 * Just a wrapper - to the caller, `upgradeContent` makes more sense, but here `processField` is more adequate.
 * @param params The content parameters to upgrade.
 * @param getUpgradesScript Function that returns the upgrade script for the content type.
 * @param getLatestLibraryVersion Function that returns the latest library version.
 * @param targetVersion Optional target version to upgrade to. If not provided, all upgrade functions for newer versions will be applied.
 * @returns Upgraded content parameters.
 */
const upgradeContent = (
  params: UpgradeInput,
  getUpgradesScript: (machineName: string) => UpgradeFunctions | undefined | any = () => {},
  getLatestLibraryVersion?: (machineName: string) => Version | undefined,
  targetVersion: Partial<Version> = {}
): UpgradeResult => {
  return processField(params, getUpgradesScript, getLatestLibraryVersion, targetVersion) || params;
};

/**
 * Recursively process parameter fields and upgrade them if required
 * @param params The content parameters to upgrade.
 * @param getUpgradesScript Function that returns the upgrade script for the content type.
 * @param getLatestLibraryVersion Function that returns the latest library version.
 * @param targetVersion Optional target version to upgrade to. If not provided, all upgrade functions for newer versions will be applied.
 * @returns Upgraded content parameters.
 */
const processField = (
  params: any,
  getUpgradesScript: any,
  getLatestLibraryVersion: any,
  targetVersion: any
): any => {
  const isGroup = typeof params === 'object' && params !== null;
  if (isGroup) {
    const isLibraryField = params.library && params.params;
    if (isLibraryField) {
      // Upgrade child parameters recursively first (depth-first)
      params.params = processField(params.params, getUpgradesScript, getLatestLibraryVersion, targetVersion);

      const { machineName, majorVersion, minorVersion } = buildLibraryInfo(params.library);

      const processed = processParams(
        params.params,
        params.metadata,
        getUpgradesScript(machineName),
        { major: majorVersion, minor: minorVersion },
        targetVersion
      );

      const versionFunction = (targetVersion?.major && targetVersion?.minor) ?
        () => targetVersion :
        getLatestLibraryVersion;

      params.library = upgradeLibrary(params.library, versionFunction);
      params.params = processed.params;
      params.metadata = processed.metadata;

      return params;
    }
    else {
      // Process all group fields recursively
      for (const key in params) {
        params[key] = processField(params[key], getUpgradesScript, getLatestLibraryVersion, targetVersion);
      }

      return params;
    }
  }
  else if (Array.isArray(params)) {
    // Process list items fields recursively
    return params.map(item => processField(item, getUpgradesScript, getLatestLibraryVersion, targetVersion));
  }

  return params;
}

/**
 * Build library information from a versioned name string (like H5P core for content types).
 * @param versionedName The versioned name string in the format 'machine
 * @returns An object containing the libraryInfo.
 */
const buildLibraryInfo = (versionedName: any) => {
  // if versioned name is not a string and does not match 'machineName version' format, throw an error
  if (typeof versionedName !== 'string' || !/^[\w0-9\-\.]{1,255}\s\d+\.\d+$/.test(versionedName)) {
    throw new Error(`Invalid versioned name: ${versionedName}`);
  }

  const [machineName, version] = versionedName.split(' ', 2);
  const [majorVersion, minorVersion] = version.split('.').map(Number);
  const versionedNameNoSpaces = versionedName.replace(/\s/g, '');

  return { machineName, majorVersion, minorVersion, versionedName, versionedNameNoSpaces };
}

/**
 * Process parameters using the provided upgrade functions.
 * @param params The content parameters to upgrade.
 * @param metadata Metadata associated with the content.
 * @param upgradeFunctions The upgrade functions organized by major and minor versions.
 * @param currentVersion The current version of the content parameters.
 * @param targetVersion Optional target version to upgrade to. If not provided, all upgrade functions for newer versions will be applied.
 * @returns Upgraded content parameters and metadata.
 */
const processParams = (
  params: any,
  metadata: any,
  upgradeFunctions: any,
  currentVersion: any,
  targetVersion: any
) => {
  for (let major in upgradeFunctions) {
    const majorInt = parseInt(major);
    if (currentVersion.major > majorInt) {
      continue; // Skip, as upgrade function is for older major versions than current
    }

    if (targetVersion && targetVersion.major < majorInt) {
      continue; // Skip, as upgrade function is for newer major versions than target
    }

    for (let minor in upgradeFunctions[major]) {
      const minorInt = parseInt(minor);

      if (currentVersion.major === majorInt && currentVersion.minor >= minorInt) {
        continue; // Skip, as upgrade function is for older minor versions than current
      }

      if (targetVersion && targetVersion.major === majorInt && targetVersion.minor < minorInt) {
        continue; // Skip, as upgrade function is for newer minor versions than target
      }

      const upgraded = upgradeParams(params, upgradeFunctions[major][minor], { metadata: metadata });

      params = upgraded.params;
      metadata = upgraded.extras.metadata;
    }
  }

  return { params, metadata };
};

/**
 * Upgrade content parameters using the provided upgrade function.
 * @param params The content parameters to upgrade.
 * @param upgradeFunction The function that performs the upgrade.
 * @param extras Optional extra data for the upgrade process.
 * @returns Upgraded parameters and extras, or original values if error occurred.
 */
const upgradeParams = (params: any, upgradeFunction: any, extras: any = {}) => {
  if (!params || typeof upgradeFunction !== 'function') {
    ui.warn('invalid parameters or upgrade function');
    return { params, extras };
  }

  // In theory, we could just modify the values directly, but to avoid side effects ...
  const clonedParams = JSON.parse(JSON.stringify(params));
  const clonedExtras = JSON.parse(JSON.stringify(extras));

  const result: { params: any; extras: any; error: any } =
    { params: clonedParams, extras: clonedExtras, error: null };

  try {
    // Pass everything to content type's upgrade function without replication callback chaining from H5P core.
    upgradeFunction(
      clonedParams,
      (error: any, upgradedParams: any, upgradedExtras: any) => {
        if (error) {
          result.error = error;
        }
        else if (upgradedParams) {
          result.params = upgradedParams;

          if (upgradedExtras?.metadata) {
            result.extras.metadata = upgradedExtras.metadata;
          }
        }
      },
      clonedExtras
    );
  }
  catch (error) {
    result.error = error;
  }

  if (result.error) {
    // ui.error prints the stack only under --verbose, which is where it belongs.
    ui.error(result.error);

    return {
      params: clonedParams,
      extras: clonedExtras
    };
  }

  return {
    params: result.params,
    extras: result.extras
  };
};

/**
 * Upgrade library string to the new version.
 * @param versionedName The versioned name string in the format 'machineName version'.
 * @param getLatestLibraryVersion Function that returns the latest library version.
 * @returns Upgraded library name.
 */
var upgradeLibrary = (versionedName: any, getLatestLibraryVersion: any) => {
  const machineName = versionedName.split(' ')[0];
  const latestVersion = getLatestLibraryVersion(machineName);
  return `${machineName} ${latestVersion.major}.${latestVersion.minor}`;
};

export {
  upgradeContent,
};
