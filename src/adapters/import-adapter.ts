import logic from '../../logic';

export interface IImportAdapter {
  import(folder: string, archive?: string): string;
}

export class ImportAdapter implements IImportAdapter {
  import(folder: string, archive?: string): string {
    return logic.import(folder, archive);
  }
}
