import { importContent } from '../logic/content.ts';

export interface IImportAdapter {
  import(folder: string, archive?: string): string;
}

export class ImportAdapter implements IImportAdapter {
  import(folder: string, archive?: string): string {
    return importContent(folder, archive);
  }
}
