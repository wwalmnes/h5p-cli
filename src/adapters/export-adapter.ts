import logic from '../../logic';

export interface IExportAdapter {
  export(library: string, folder?: string): Promise<string>;
}

export class ExportAdapter implements IExportAdapter {
  export(library: string, folder?: string): Promise<string> {
    return logic.export(library, folder);
  }
}
