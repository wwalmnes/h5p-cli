import { exportContent } from '../logic/content.ts';

export interface IExportAdapter {
  export(library: string, folder?: string): Promise<string>;
}

export class ExportAdapter implements IExportAdapter {
  export(library: string, folder?: string): Promise<string> {
    return exportContent(library, folder);
  }
}
