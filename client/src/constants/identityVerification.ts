export const IDENTITY_PROVIDERS = {
  CIE: "CIE",
  SPID: "SPID",
} as const;

export const IDENTITY_ERROR_CODES = {
  ACCOUNT_ALREADY_VERIFIED: "ACCOUNT_ALREADY_VERIFIED",
  CIE_TRANSACTION_ALREADY_ACTIVE: "CIE_TRANSACTION_ALREADY_ACTIVE",
} as const;

const IDENTITY_PROVIDER_LABELS: Record<string, string> = {
  [IDENTITY_PROVIDERS.CIE]: "CIE",
  [IDENTITY_PROVIDERS.SPID]: "SPID",
};

export function getIdentityProviderLabel(provider?: string) {
  if (!provider) return undefined;
  return IDENTITY_PROVIDER_LABELS[provider.toUpperCase()];
}
