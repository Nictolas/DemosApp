import { describe, expect, it } from 'vitest';
import { resolveOpinionVaultCutoverPolicy } from './opinionVaultCutoverPolicy';

describe('opinionVaultCutoverPolicy', () => {
  it('is fail-closed by default and for unknown values', () => {
    expect(resolveOpinionVaultCutoverPolicy(undefined)).toEqual({mode:'off',allowVaultRead:false,allowLegacyImport:false});
    expect(resolveOpinionVaultCutoverPolicy('true')).toEqual({mode:'off',allowVaultRead:false,allowLegacyImport:false});
    expect(resolveOpinionVaultCutoverPolicy('unexpected')).toEqual({mode:'off',allowVaultRead:false,allowLegacyImport:false});
  });

  it('allows legacy import only in the explicit bootstrap phase', () => {
    expect(resolveOpinionVaultCutoverPolicy('bootstrap')).toEqual({mode:'bootstrap',allowVaultRead:true,allowLegacyImport:true});
    expect(resolveOpinionVaultCutoverPolicy('vault-only')).toEqual({mode:'vault-only',allowVaultRead:true,allowLegacyImport:false});
  });
});
