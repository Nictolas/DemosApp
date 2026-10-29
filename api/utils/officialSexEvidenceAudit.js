'use strict';

/**
 * AUDIT ONLY. Non aggiorna Supabase, users.sesso o la CIE.
 *
 * Il valore anagrafico pubblicato da una fonte istituzionale non deve essere
 * spacciato per un attributo verificato tramite CIE OIDC. Questa funzione
 * produce solo possibili corrispondenze che richiedono revisione umana.
 */
const OFFICIAL_HOSTS = new Set(['dati.senato.it', 'dati.camera.it']);

function isOfficialSourceUrl(raw) {
  if (typeof raw !== 'string') return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !OFFICIAL_HOSTS.has(url.hostname.toLowerCase())) return false;
    if (url.hostname.toLowerCase() === 'dati.camera.it') {
      // Camera: link a una risorsa anagrafica parlamentare, non a una pagina arbitraria.
      return /^\/ocd\/deputato\.rdf\/d\d+_\d+\/?$/.test(url.pathname) &&
        url.search === '' && url.hash === '';
    }
    return true;
  } catch {
    return false;
  }
}

function normalizedName(raw) {
  if (typeof raw !== 'string') return null;
  const result = raw.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('it');
  return result.length >= 2 && result.length <= 100 ? result : null;
}

function validIsoDate(raw) {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || date.getTime() > Date.now() ||
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== m - 1 ||
      date.getUTCDate() !== d) return null;
  return raw;
}

function matchKey(row) {
  const firstName = normalizedName(row?.nome);
  const familyName = normalizedName(row?.cognome);
  const birthDate = validIsoDate(row?.data_nascita);
  return firstName && familyName && birthDate
    ? JSON.stringify([firstName, familyName, birthDate])
    : null;
}

/**
 * Camera dei deputati, output SPARQL JSON con variabili
 * deputato/nome/cognome/dataNascita/genere. Fonte: foaf:gender.
 * Le date della Camera sono spesso YYYYMMDD, diverse dal formato ISO dei profili DEMOS.
 * Solo i valori ufficiali letterali 'male'/'female' vengono convertiti in M/F.
 * Qualsiasi dato incompleto, anomalo o con URL non istituzionale viene scartato.
 */
function parseCameraSparqlBindings(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Atteso un array di bindings SPARQL');
  const result = [];
  for (const row of rows) {
    const get = key => {
      const binding = row?.[key];
      return (binding?.type === 'uri' || binding?.type === 'literal') &&
        typeof binding.value === 'string' ? binding.value : null;
    };
    const deputyUri = get('deputato');
    const nome = get('nome');
    const cognome = get('cognome');
    const born = get('dataNascita');
    const gender = get('genere');
    if (!deputyUri || !nome || !cognome || !born) continue;
    const match = /^https?:\/\/dati\.camera\.it\/ocd\/deputato\.rdf\/(d\d+_\d+)\/?$/.exec(deputyUri);
    if (!match) continue;
    const date = /^\d{8}$/.test(born)
      ? born.slice(0,4) + '-' + born.slice(4,6) + '-' + born.slice(6,8)
      : born;
    if (!validIsoDate(date)) continue;
    const sesso = gender === 'male' ? 'M' : gender === 'female' ? 'F' : null;
    if (!sesso) continue;
    const record = {
      external_id: deputyUri,
      nome,
      cognome,
      data_nascita: date,
      sesso,
      source_url: 'https://dati.camera.it/ocd/deputato.rdf/' + match[1]
    };
    if (isOfficialSourceUrl(record.source_url)) result.push(record);
  }
  return result;
}

function auditOfficialSexEvidence(users, officialRecords) {
  if (!Array.isArray(users) || !Array.isArray(officialRecords)) {
    throw new TypeError('Sono richiesti due array: utenti e record istituzionali');
  }

  const candidatesByKey = new Map();
  for (const row of users) {
    if (!['PERSON', 'P'].includes(row?.account_type) || row?.ruolo !== 'P' ||
        row?.sesso != null || typeof row?.id !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(row.id)) continue;
    const key = matchKey(row);
    if (!key) continue;
    const list = candidatesByKey.get(key) || [];
    list.push(row.id);
    candidatesByKey.set(key, list);
  }

  const evidenceByKey = new Map();
  const seenSourceIds = new Map();
  for (const record of officialRecords) {
    if (!isOfficialSourceUrl(record?.source_url) ||
        (record?.sesso !== 'M' && record?.sesso !== 'F') ||
        typeof record?.external_id !== 'string' ||
        record.external_id.length < 2 || record.external_id.length > 200) continue;
    const key = matchKey(record);
    if (!key) continue;
    const id = record.external_id;
    // La stessa identità ufficiale non può identificare persone differenti.
    const alreadyMapped = seenSourceIds.get(id);
    if (alreadyMapped && alreadyMapped !== key) {
      seenSourceIds.set(id, 'CONFLICT');
    } else if (!alreadyMapped) {
      seenSourceIds.set(id, key);
    }
    const list = evidenceByKey.get(key) || [];
    // Un endpoint parlamentare può ripetere la stessa risorsa in più righe.
    // Deduplichiamo solo record identici; disaccordi rimangono ambigui.
    if (!list.some(candidate =>
      candidate.id === id &&
      candidate.sesso === record.sesso &&
      candidate.source_url === record.source_url)) {
      list.push({ id, sesso: record.sesso, source_url: record.source_url });
    }
    evidenceByKey.set(key, list);
  }

  const reviewRequired = [];
  const skipped = { ambiguousUsers: 0, ambiguousOfficial: 0, noOfficialMatch: 0 };
  for (const [key, ids] of candidatesByKey.entries()) {
    if (ids.length !== 1) {
      skipped.ambiguousUsers += ids.length;
      continue;
    }
    const records = evidenceByKey.get(key) || [];
    if (records.length === 0) {
      skipped.noOfficialMatch++;
      continue;
    }
    if (records.length !== 1 || seenSourceIds.get(records[0].id) !== key) {
      skipped.ambiguousOfficial++;
      continue;
    }
    reviewRequired.push({
      user_id: ids[0],
      official_declared_sex: records[0].sesso,
      source_url: records[0].source_url,
      official_record_id: records[0].id,
      match_method: 'EXACT_NAME_SURNAME_AND_DOB',
      review_status: 'REQUIRES_MANUAL_VERIFICATION',
      cie_verified: false
    });
  }

  return {
    mode: 'READ_ONLY_REVIEW',
    writes_performed: 0,
    review_required_count: reviewRequired.length,
    considered_users_with_complete_identity: [...candidatesByKey.values()]
      .reduce((sum, ids) => sum + ids.length, 0),
    skipped,
    review_required: reviewRequired
  };
}

module.exports = { auditOfficialSexEvidence, isOfficialSourceUrl, matchKey, parseCameraSparqlBindings };