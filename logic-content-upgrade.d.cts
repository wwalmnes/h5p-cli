export interface Version {
  major: number;
  minor: number;
}

/** Map of major -> minor -> upgrade function, as declared in a library's upgrades.js */
export type UpgradeFunctions = Record<string, Record<string, Function>>;

export interface UpgradeInput {
  /** Versioned name, e.g. "H5P.Accordion 1.0" */
  library: string;
  params: any;
  metadata?: any;
}

export interface UpgradeResult {
  library: string;
  params: any;
  metadata: any;
}

/**
 * Upgrade content parameters to a newer library version by applying the
 * upgrade functions declared in the library's upgrades.js.
 */
export declare function upgradeContent(
  params: UpgradeInput,
  getUpgradesScript?: (machineName: string) => UpgradeFunctions | undefined | any,
  getLatestLibraryVersion?: (machineName: string) => Version | undefined,
  targetVersion?: Partial<Version>
): UpgradeResult;
