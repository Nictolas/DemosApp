import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(__dirname, 'useCandidatiData.ts'), 'utf8');

describe('useCandidatiData privacy-first cutover guard', () => {
  it('checks local matching gate before legacy candidate matching URL', () => {
    const gate = source.indexOf('isLocalPoliticalMatchingEnabled()');
    const legacy = source.indexOf('/api/candidati/disponibili');
    expect(gate).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(gate);
  });

  it('privacy branch is fail-closed and cannot call legacy matching', () => {
    const start = source.indexOf('if (!isRappresentanteRoute && isLocalPoliticalMatchingEnabled())');
    const end = source.indexOf('// Mappa la categoria al grado_candidatura corretto', start);
    const branch = source.slice(start, end);
    expect(branch).toContain("kind: 'candidate'");
    expect(branch).toContain('matchPoliticalVectorsLocally');
    expect(branch).toMatch(/setCandidatoSelezionato[\s\S]*return;/);
    expect(branch).not.toContain('/api/candidati/disponibili');
  });
});
