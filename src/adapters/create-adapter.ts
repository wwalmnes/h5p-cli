import fs from 'fs';

export interface ICreateAdapter {
  exists(path: string): boolean;
  mkdirSync(path: string): void;
  writeFile(filePath: string, content: string): void;
}

export class CreateAdapter implements ICreateAdapter {
  exists(path: string): boolean {
    return fs.existsSync(path);
  }

  mkdirSync(path: string): void {
    fs.mkdirSync(path, { recursive: true });
  }

  writeFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content);
  }
}
