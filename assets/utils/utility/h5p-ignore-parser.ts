import * as parser from 'gitignore-parser';
import fs from 'fs';

/**
 * Gets an accepted files filter for given directory
 * @param path Path to h5pIgnore file
 * @returns Function that returns true for accepted directories
 */
const getAcceptedFilter = function (path: string): (filePath: string) => boolean {
  const fileReader = fs.readFileSync(path + '/.h5pignore', 'utf8');
  const h5pIgnore = parser.compile(fileReader);
  return h5pIgnore.accepts;
};

export default getAcceptedFilter;
