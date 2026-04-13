import logic from '../../logic.ts';

export interface IVerifyAdapter {
  verifySetup(library: string): Promise<any>;
}

export class VerifyAdapter implements IVerifyAdapter {
  verifySetup(library: string): Promise<any> {
    return logic.verifySetup(library);
  }
}
