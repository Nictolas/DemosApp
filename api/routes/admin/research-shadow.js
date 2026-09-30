const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { getPool } = require('../../config/database');
const shadowConfig = require('../../config/privacyResearchShadow');

const router = express.Router();

router.use(verifyToken, requireAdmin);

// Endpoint esclusivamente diagnostico. Non legge opinioni, token o righe utente.
router.get('/status', async (req, res) => {
  const pool = getPool();

  const [schemasResult, tablesResult, grantsResult] = await Promise.all([
    pool.query(
      `SELECT schema_name
       FROM information_schema.schemata
       WHERE schema_name = ANY($1::text[])
       ORDER BY schema_name`,
      [shadowConfig.expectedSchemas]
    ),
    pool.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_schema = ANY($1::text[])
         AND table_type = 'BASE TABLE'
       ORDER BY table_schema, table_name`,
      [shadowConfig.expectedSchemas]
    ),
    pool.query(
      `SELECT table_schema, table_name, grantee, privilege_type
       FROM information_schema.role_table_grants
       WHERE table_schema = ANY($1::text[])
         AND grantee IN ('anon', 'authenticated')
       ORDER BY table_schema, table_name, grantee, privilege_type`,
      [shadowConfig.expectedSchemas]
    )
  ]);

  const presentSchemas = schemasResult.rows.map((row) => row.schema_name);
  const presentTables = tablesResult.rows.map(
    (row) => `${row.table_schema}.${row.table_name}`
  );

  const missingSchemas = shadowConfig.expectedSchemas.filter(
    (schema) => !presentSchemas.includes(schema)
  );
  const missingTables = shadowConfig.expectedTables.filter(
    (table) => !presentTables.includes(table)
  );

  res.json({
    success: true,
    data: {
      enabled: shadowConfig.enabled,
      mode: shadowConfig.mode,
      schemaReady: missingSchemas.length === 0 && missingTables.length === 0,
      presentSchemas,
      missingSchemas,
      presentTables,
      missingTables,
      directDataApiGrants: grantsResult.rows
    }
  });
});

module.exports = router;
