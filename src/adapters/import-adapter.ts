import logic from '../../logic.ts';

export interface IImportAdapter {
  import(folder: string, archive?: string): string;
}

export class ImportAdapter implements IImportAdapter {
  import(folder: string, archive?: string): string {
    return logic.import(folder, archive);
  }
}
