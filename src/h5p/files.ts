import fs from 'fs';
// @ts-ignore - no type declarations for superagent v8 in this project
import superAgent from 'superagent';

// get file from source and optionally parse it as JSON
export const getFile = async (source: string, parseJson?: boolean): Promise<string | object> => {
  const local = source.indexOf('http') !== 0 ? true : false;
  let output;
  if (local) {
    if (!fs.existsSync(source)) {
      return '';
    }
    output = fs.readFileSync(source, 'utf-8');
  }
  else {
    output = (await superAgent.get(source).set('User-Agent', 'h5p-cli').ok((res: any) => [200, 404].includes(res.status))).text;
  }
  if (output == '404: Not Found') {
    return '';
  }
  if (parseJson) {
    output = JSON.parse(output);
  }
  return output;
};
// generates list of files and their relative paths in a folder tree
export const getFileList = (folder: string): string[] => {
  const output: string[] = [];
  let toDo = [folder];
  let list: string[] = [];
  const compute = () => {
    for (let item of list) {
      const dirs = fs.readdirSync(item);
      for (let entry of dirs) {
        const file = `${item}/${entry}`;
        if (fs.lstatSync(file).isDirectory()) {
          toDo.push(file);
        }
        else {
          output.push(file);
        }
      }
    }
  };
  while (toDo.length) {
    list = toDo;
    toDo = [];
    compute();
  }
  return output;
};
/* Fetch a URL without collapsing the status. getFile() maps 404 to '', which is
also the correct answer for a library that legitimately has no semantics.json —
the metadata transport has to tell those two cases apart. */
type RemoteFile = { status: number; text: string };
export const getRemoteFile = async (url: string): Promise<RemoteFile> => {
  try {
    const res = await superAgent.get(url).set('User-Agent', 'h5p-cli').ok(() => true);
    return { status: res.status, text: res.text ?? '' };
  }
  catch {
    // DNS failure, TLS failure, offline: indistinguishable from "not reachable"
    return { status: 0, text: '' };
  }
};
