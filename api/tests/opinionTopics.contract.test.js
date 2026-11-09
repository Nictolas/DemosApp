'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'client/src/lib/opinionTopics.ts'), 'utf8');
const opinions = Array.from({length: 6}, (_, n) =>
  require(path.join(root, 'api/catalog/opinions-part-0' + n + '.json'))
).flat();

const match = source.match(/export const OPINION_TOPIC_BY_ID:[\s\S]*?Object\.freeze\((\{[\s\S]*?\})\);/);
assert.ok(match, 'La mappatura statica deve essere una mappa letterale JSON parsabile');
const mapping = JSON.parse(match[1]);
const definitions = Array.from(source.matchAll(
  /\{ id: "([^"]+)", title: "([^"]+)", icon: "([^"]+)", description: "([^"]+)" \},/g
), ([, id, title, icon, description]) => ({ id, title, icon, description }));

test('tutte e sole le 94 Opinioni ufficiali hanno un unico argomento', () => {
  assert.equal(opinions.length, 94);
  const ids = opinions.map(o => o.id);
  assert.equal(new Set(ids).size, ids.length, 'ID catalogo duplicati');
  assert.equal(Object.keys(mapping).length, 94, 'La categoria deve essere assegnata 94 volte');
  assert.deepEqual(Object.keys(mapping).sort(), [...ids].sort());
});

test('le 11 categorie sono identificatori stabili, neutri e distinte', () => {
  assert.equal(definitions.length, 11);
  const categoryIds = new Set(definitions.map(d => d.id));
  assert.equal(categoryIds.size, definitions.length);
  for (const def of definitions) {
    assert.match(def.id, /^[a-z][a-z0-9_]+$/);
    assert.ok(def.title.trim() && def.icon.trim() && def.description.trim());
  }
  for (const [id, topic] of Object.entries(mapping)) {
    assert.ok(categoryIds.has(topic), 'Categoria sconosciuta per ' + id);
  }
  const counts = new Map([...categoryIds].map(id => [id, 0]));
  for (const topic of Object.values(mapping)) counts.set(topic, counts.get(topic) + 1);
  assert.ok([...counts.values()].every(n => n > 0));
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), 94);
});

test('i livelli E/N/R/C/CO rimangono una dimensione distinta', () => {
  const grades = new Set(opinions.flatMap(o => o.gradi_opinione));
  assert.deepEqual([...grades].sort(), ['C', 'CO', 'E', 'N', 'R']);
  const multi = opinions.filter(o => o.gradi_opinione.length > 1);
  assert.ok(multi.length > 0);
  assert.ok(multi.every(o => mapping[o.id]), 'Anche le Opinioni multi-livello hanno un tema');
  assert.doesNotMatch(source, /apiRequest|fetch\s*\(|localStorage|indexedDB|supabase|SELECT\s+/i,
    'La tassonomia non deve creare nuove letture o storage');
});

test('opinioni nuove o rimosse richiedono revisione della mappa', () => {
  const publishedIds = new Set(opinions.map(o => o.id));
  for (const id of Object.keys(mapping)) assert.ok(publishedIds.has(id));
  assert.equal(publishedIds.size, Object.keys(mapping).length);
});

test('filtro provinciale C: tutti e soli gli ID pubblicati, senza query aggiuntive', () => {
  const file = fs.readFileSync(path.join(root, 'client/src/lib/opinionProvincialIds.ts'), 'utf8');
  const ids = [...file.matchAll(/^\s*"([a-z0-9_]+)",$/gm)].map(match => match[1]).sort();
  const published = opinions.filter(q => q.gradi_opinione.includes('C')).map(q => q.id).sort();
  assert.deepEqual(ids, published, 'Metadati C devono coincidere col catalogo ufficiale');
  assert.equal(ids.length, 6);
  assert.ok(opinions.filter(q => q.gradi_opinione.includes('C'))
    .every(q => q.gradi_opinione.some(grade => ['E','N','R','CO'].includes(grade))),
    'Una futura Opinione solo provinciale richiede una nuova API e revisione privacy');
  assert.doesNotMatch(file, /apiRequest|fetch\s*\(|localStorage|indexedDB|supabase|SELECT\s+/i);
});
