const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const oauthConfigRoutes = require('../routes/auth/oauth-config');

async function withServer(run) {
  const app = express();
  app.use('/api/auth', oauthConfigRoutes);

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });

  try {
    const address = server.address();
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('GET /api/auth/oauth/config exposes only public client identifiers', async () => {
  const previousGoogle = process.env.GOOGLE_CLIENT_ID;
  const previousApple = process.env.APPLE_CLIENT_ID;

  process.env.GOOGLE_CLIENT_ID = 'google-client-id.apps.exampleusercontent.com';
  process.env.APPLE_CLIENT_ID = 'community.demos.web';

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/oauth/config`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control') || '', /max-age=300/);

      const body = await response.json();
      assert.deepEqual(body, {
        success: true,
        googleClientId: 'google-client-id.apps.exampleusercontent.com',
        appleClientId: 'community.demos.web',
      });

      assert.equal('googleClientSecret' in body, false);
      assert.equal('appleClientSecret' in body, false);
    });
  } finally {
    if (previousGoogle === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousGoogle;

    if (previousApple === undefined) delete process.env.APPLE_CLIENT_ID;
    else process.env.APPLE_CLIENT_ID = previousApple;
  }
});

test('GET /api/auth/oauth/config returns null for unconfigured providers', async () => {
  const previousGoogle = process.env.GOOGLE_CLIENT_ID;
  const previousApple = process.env.APPLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.APPLE_CLIENT_ID;

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/oauth/config`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body, {
        success: true,
        googleClientId: null,
        appleClientId: null,
      });
    });
  } finally {
    if (previousGoogle === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousGoogle;

    if (previousApple === undefined) delete process.env.APPLE_CLIENT_ID;
    else process.env.APPLE_CLIENT_ID = previousApple;
  }
});
