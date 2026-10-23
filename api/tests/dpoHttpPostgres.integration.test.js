const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');
const { Pool } = require('pg');
const pool = new Pool();
const routePath = path.resolve(__dirname, '../routes/dpo/overview.js');
const middlewarePath = path.resolve(__dirname, '../middleware/dpoAccess.js');
const originalLoad = Module._load;
let router;
try {
  Module._load = function (request, parent, isMain) {
    if (request.endsWith('middleware/auth') || (request === './auth' && parent?.filename === middlewarePath)) {
      return {
        pool,
        verifyToken(req, res, next) {
          const authorization = req.headers.authorization;
          if (!authorization?.startsWith('Bearer synthetic-')) return res.status(401).json({success:false});
          const userId = authorization.slice('Bearer synthetic-'.length);
          req.user = {id:userId, isAdmin:userId === 'admin'};
          next();
        }
      };
    }
    return originalLoad.apply(this, arguments);
  };
  delete require.cache[routePath];
  delete require.cache[middlewarePath];
  router = require(routePath);
} finally {
  Module._load = originalLoad;
}
const express = require('express');
const app = express();
app.use('/api/dpo', router);

async function request(token) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const response = await fetch('http://127.0.0.1:' + address.port + '/api/dpo/overview', {
      headers: token ? { Authorization: 'Bearer synthetic-' + token } : {}
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('HTTP API against temporary PostgreSQL: authorization, aggregate response, and revocation', async () => {
  try {
    await pool.query("UPDATE public.users SET is_dpo=TRUE WHERE id='dpo'");
    await pool.query('INSERT INTO public.user_rights_requests DEFAULT VALUES');
    assert.equal((await request()).status, 401);
    assert.equal((await request('ordinary')).status, 403);
    assert.equal((await request('inactive')).status, 403);
    const adminOverview = await request('admin');
    assert.equal(adminOverview.status, 200);
    assert.equal(adminOverview.body.data.role, 'Admin');
    assert.equal(adminOverview.body.data.gdpr_requests_total, 1);
    assert.equal(JSON.stringify(adminOverview.body).includes('user_id'), false);
    await pool.query("UPDATE public.users SET is_admin=FALSE WHERE id='admin'");
    assert.equal((await request('admin')).status, 403);
    await pool.query("UPDATE public.users SET is_admin=TRUE WHERE id='admin'");
    const approved = await request('dpo');
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.role, 'DPO');
    assert.equal(approved.body.data.gdpr_requests_total, 1);
    assert.equal(JSON.stringify(approved.body).includes('user_id'), false);
    await pool.query("UPDATE public.users SET is_dpo=FALSE WHERE id='dpo'");
    assert.equal((await request('dpo')).status, 403);
  } finally {
    await pool.end();
  }
});
