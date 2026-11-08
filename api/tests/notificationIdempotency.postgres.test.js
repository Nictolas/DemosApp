'use strict';

// Real PostgreSQL, but ONLY against an isolated GitHub Actions service.
// Never point this test at Supabase, Render, staging or a developer's database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const INSERT = `INSERT INTO notifiche_demos (id, id_utente, titolo, testo, data, data_creazione, idempotency_key)
  VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE, NOW(), $4::uuid)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id`;

test('CR-13 manual migration enforces idempotent concurrent inserts on isolated PostgreSQL', async t => {
  if (process.env.CI !== 'true' || !process.env.DEMOS_TEST_DATABASE_URL) {
    t.skip('Requires CI and isolated local PostgreSQL service');
    return;
  }
  const url = new URL(process.env.DEMOS_TEST_DATABASE_URL);
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/demos_ci_notifiche');
  assert.equal(url.username, 'demos_ci');
  assert.equal(url.port, '5432');

  const pool = new Pool({ connectionString: url.toString(), max: 8, connectionTimeoutMillis: 3000 });
  try {
    const existing = await pool.query("SELECT to_regclass('public.notifiche_demos') AS table_name");
    assert.equal(existing.rows[0].table_name, null, 'CI test must start with a fresh synthetic table');

    // Recreate only the columns used by the notification writer, never production data.
    await pool.query(`CREATE TABLE public.notifiche_demos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_utente UUID NOT NULL,
      titolo TEXT NOT NULL,
      testo TEXT NOT NULL,
      data DATE,
      data_creazione TIMESTAMPTZ
    )`);
    const recipient = '33333333-3333-4333-8333-333333333333';
    await pool.query('INSERT INTO public.notifiche_demos (id_utente, titolo, testo) VALUES ($1, $2, $3)',
      [recipient, 'Preesistente', 'Riga legacy']);

    // Use the exact hand-prepared migration, unchanged, in the ephemeral database.
    const migration = fs.readFileSync(
      path.join(__dirname, '../../sql/manual/20261101_notifications_inbox_idempotency.sql'), 'utf8'
    );
    await pool.query(migration);

    const index = await pool.query(`SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'notifiche_demos'
        AND indexname = 'notifiche_demos_idempotency_key_unique'`);
    assert.equal(index.rows.length, 1);
    assert.match(index.rows[0].indexdef, /UNIQUE INDEX/);
    assert.match(index.rows[0].indexdef, /idempotency_key IS NOT NULL/);

    const oldRows = await pool.query('SELECT count(*)::integer AS total FROM notifiche_demos WHERE idempotency_key IS NULL');
    assert.equal(oldRows.rows[0].total, 1, 'migration must preserve pre-existing notifications');

    const key = '11111111-1111-4111-8111-111111111111';
    const params = [recipient, 'Avviso sintetico', 'Testo sintetico', key];

    // Eight different PostgreSQL connections contend for the same unique key.
    const writes = await Promise.all(Array.from({ length: 8 }, () => pool.query(INSERT, params)));
    assert.equal(writes.filter(x => x.rows.length === 1).length, 1);
    assert.equal(writes.filter(x => x.rows.length === 0).length, 7);
    const one = await pool.query(
      'SELECT id, id_utente, titolo, testo FROM notifiche_demos WHERE idempotency_key = $1::uuid', [key]
    );
    assert.equal(one.rows.length, 1);
    assert.equal(one.rows[0].id_utente, recipient);
    assert.equal(one.rows[0].titolo, params[1]);
    assert.equal(one.rows[0].testo, params[2]);

    // Same key, changed content: database does not overwrite existing content.
    const conflicting = await pool.query(INSERT, [recipient, 'Titolo modificato', params[2], key]);
    assert.equal(conflicting.rows.length, 0);
    const original = await pool.query(
      'SELECT titolo FROM notifiche_demos WHERE idempotency_key = $1::uuid', [key]);
    assert.equal(original.rows[0].titolo, params[1]);

    // Different send key is an intentionally new notification.
    const second = await pool.query(INSERT, [recipient, params[1], params[2],
      '22222222-2222-4222-8222-222222222222']);
    assert.equal(second.rows.length, 1);

    const total = await pool.query('SELECT count(*)::integer AS total FROM notifiche_demos');
    assert.equal(total.rows[0].total, 3, 'one legacy + one replay-safe send + one new send');

    // Re-applying the migration is safe and retains the same unique constraint.
    await pool.query(migration);
    const replay = await pool.query(INSERT, params);
    assert.equal(replay.rows.length, 0);
  } finally {
    await pool.query('DROP TABLE IF EXISTS public.notifiche_demos').catch(() => {});
    await pool.end();
  }
});
