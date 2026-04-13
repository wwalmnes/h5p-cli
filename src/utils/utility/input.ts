import fs from 'fs';
import { findRepos } from '../../lib/process-repos.ts';

const defaultFileName = process.env.H5P_DEFAULT_PACK || 'libraries.h5p';

class Input {
  inputList: string[];
  flags: string[];
  fileNames: string[];
  remainingInputs: string[];
  libraries: string[] = [];
  languages: string[] = [];

  /**
   * Input list
   * @param inputList List of inputs
   */
  constructor(inputList: string[] = []) {
    this.inputList = inputList;

    this.flags = this.inputList.filter(Input.isFlag);
    this.fileNames = this.inputList.filter(Input.isFileName);

    this.remainingInputs = this.inputList
      .filter(x => !Input.isFlag(x))
      .filter(x => !Input.isFileName(x));
  }

  init(skipCheck = false): Promise<void> {
    const dirs$ = skipCheck
      ? Promise.resolve(fs.readdirSync('.') as string[])
      : findRepos();
    return dirs$
      .then((dirs: string[]) => {
        if (this.remainingInputs.indexOf('*') >= 0) {
          this.libraries = dirs;
          this.remainingInputs = this.remainingInputs.filter(i => {
            return i !== '*';
          });
        }
        else {
          this.libraries = this.remainingInputs
            .map(Input.removeTrailingDash)
            .filter(x => Input.isLibrary(x, dirs));
        }

        this.languages = this.remainingInputs
          .filter(x => this.libraries.indexOf(x) < 0);
      });
  }

  /**
   * Determines if input contains flag
   * @param flag Flag as a string, e.g. '-r'
   * @returns True if flag was found
   */
  hasFlag(flag: string | string[]): boolean {
    if (Array.isArray(flag)) {
      return flag.reduce((prev, singleFlag) => {
        return prev || this.flags.indexOf(singleFlag) >= 0;
      }, false);
    }

    return this.flags.indexOf(flag) >= 0;
  }

  /**
   * Get file name from input, or default file name
   * @returns File name
   */
  getFileName(): string {
    if (this.fileNames.length) {
      return this.fileNames[this.fileNames.length - 1];
    }
    else {
      return defaultFileName;
    }
  }

  /**
   * Get libraries from input if it was provided.
   * @returns Libraries
   */
  getLibraries(): string[] {
    return this.libraries;
  }

  getLanguages(): string[] {
    return this.languages;
  }

  /**
   * Check if input string is a flag
   * @param input String to check if is flag
   * @returns True if input is a flag
   */
  static isFlag(input: string): boolean {
    return input.charAt(0) === '-';
  }

  /**
   * Checks if input is a file name
   * @param input String to check if is file name
   * @returns True if input is a file name
   */
  static isFileName(input: string): boolean {
    return input.match(/\.h5p$/) !== null;
  }

  static isLibrary(input: string, directories: string[]): boolean {
    return directories.indexOf(input) >= 0;
  }

  /**
   * Remove trailing dash from input
   * @param input Input string
   * @returns Input without trailing dash
   */
  static removeTrailingDash(input: string): string {
    if (input.charAt(input.length - 1) === '/') {
      input = input.substr(0, input.length - 1);
    }

    return input;
  }
}

export default Input;
