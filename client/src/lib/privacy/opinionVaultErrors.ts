export class OpinionVaultMissingError extends Error {
  constructor() {
    super('Encrypted local opinion vector missing');
    this.name = 'OpinionVaultMissingError';
  }
}
