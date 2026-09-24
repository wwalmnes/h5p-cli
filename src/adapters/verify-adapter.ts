import { verifySetup } from '../logic/install.ts';

export interface IVerifyAdapter {
  verifySetup(library: string): Promise<any>;
}

export class VerifyAdapter implements IVerifyAdapter {
  verifySetup(library: string): Promise<any> {
    return verifySetup(library);
  }
}
