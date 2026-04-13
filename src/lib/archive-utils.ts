import fs from 'fs';
import type { Archiver } from 'archiver';
import h5pIgnoreParser from '../utils/utility/h5p-ignore-parser.ts';

const allowedFilePattern = process.env.H5P_ALLOWED_FILE_PATTERN !== undefined
  ? new RegExp(process.env.H5P_ALLOWED_FILE_PATTERN, process.env.H5P_ALLOWED_FILE_MODIFIERS)
  : /\.(json|png|jpg|jpeg|gif|bmp|tif|tiff|svg|eot|ttf|woff|woff2|otf|webm|mp4|ogg|mp3|txt|pdf|rtf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|xml|csv|diff|patch|swf|md|textile|js|css)$/;

const ignorePattern = process.env.H5P_IGNORE_PATTERN !== undefined
  ? new RegExp(process.env.H5P_IGNORE_PATTERN, process.env.H5P_IGNORE_MODIFIERS)
  : /^\.|~$/gi;

export function archiveDir(archive: Archiver, dirPath: string, alias = dirPath): void {
  if (ignorePattern.test(dirPath)) return;

  let files = fs.readdirSync(dirPath);
  if (files.includes('.h5pignore')) {
    const accepts = h5pIgnoreParser(dirPath);
    files = files.filter(accepts);
  }

  for (const filename of files) {
    if (ignorePattern.test(filename)) continue;

    const file = `${dirPath}/${filename}`;
    const target = `${alias}/${filename}`;

    if (fs.lstatSync(file).isDirectory()) {
      archiveDir(archive, file, target);
    } else if (allowedFilePattern.test(filename)) {
      archive.append(fs.createReadStream(file), { name: target });
    }
  }
}
