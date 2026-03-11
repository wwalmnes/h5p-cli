import { IVerifyAdapter } from '../adapters/verify-adapter';

export class VerifyService {
  constructor(
    private adapter: IVerifyAdapter,
    private logger: { log: (...args: any[]) => void } = console
  ) {}

  async verify(library: string): Promise<void> {
    const result = await this.adapter.verifySetup(library);
    this.logger.log(result);
  }
}
