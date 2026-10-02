import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(__dirname, 'useRappresentantiData.ts'), 'utf8');

describe('useRappresentantiData privacy-first cutover guard', () => {
  it('checks the local matching gate before constructing legacy representative matching URL', () => {
    const gate = source.indexOf('isLocalPoliticalMatchingEnabled()');
    const legacy = source.indexOf('/api/rappresentanti/disponibili');
    expect(gate).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(gate);
  });

  it('returns from privacy-first branch and has no legacy fallback inside that branch', () => {
    const start = source.indexOf('if (!isTestRoute && isLocalPoliticalMatchingEnabled())');
    const end = source.indexOf("\n        let url = '';", start);
    const branch = source.slice(start, end);
    expect(branch).toContain('fetchPoliticalVectorsForLocalMatch(scope)');
    expect(branch).toContain('matchPoliticalVectorsLocally');
    expect(branch).toMatch(/setRappresentanteSelezionato[\s\S]*return;/);
    expect(branch).not.toContain('/api/rappresentanti/disponibili');
  });
});
