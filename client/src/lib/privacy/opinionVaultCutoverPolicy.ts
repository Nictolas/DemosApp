export type OpinionVaultCutoverMode = 'off' | 'bootstrap' | 'vault-only';

export type OpinionVaultCutoverPolicy = Readonly<{
  mode: OpinionVaultCutoverMode;
  allowVaultRead: boolean;
  allowLegacyImport: boolean;
}>;

export const resolveOpinionVaultCutoverPolicy = (value: unknown): OpinionVaultCutoverPolicy => {
  switch (value) {
    case 'bootstrap':
      return Object.freeze({ mode: 'bootstrap', allowVaultRead: true, allowLegacyImport: true });
    case 'vault-only':
      return Object.freeze({ mode: 'vault-only', allowVaultRead: true, allowLegacyImport: false });
    default:
      return Object.freeze({ mode: 'off', allowVaultRead: false, allowLegacyImport: false });
  }
};

export const getOpinionVaultCutoverPolicy = (): OpinionVaultCutoverPolicy =>
  resolveOpinionVaultCutoverPolicy(import.meta.env.VITE_PRIVACY_OPINION_VAULT_CUTOVER);
