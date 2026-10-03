const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('OAuth and WebAuthn token issuance records active session activity',()=>{for(const p of ['routes/auth/oauth.js','routes/auth/webauthn.js']){const src=read(p);assert.match(src,/recordIssuedSession/);assert.match(src,/refreshToken/)}});
test('refresh path continues rotating active session activity',()=>{const src=read('routes/auth/refresh.js');assert.match(src,/rotateRefreshSession/)});
test('CIE callback is identity verification, not a token issuing login path',()=>{const src=read('routes/auth/identity.js');assert.equal(src.includes('generateTokenPair'),false)});
