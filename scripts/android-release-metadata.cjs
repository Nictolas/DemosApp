'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

// Gradle remains the version source. Check what Android actually compiled before
// using that identity to label the unsigned candidate artifact.
function releaseMetadata(gradle, apkMetadata) {
  const codes = [...gradle.matchAll(/^\s*versionCode\s+([1-9]\d*)\s*$/gm)];
  const names = [...gradle.matchAll(/^\s*versionName\s+"([^"]+)"\s*$/gm)];
  assert.equal(codes.length, 1, 'Expected one literal versionCode in app/build.gradle');
  assert.equal(names.length, 1, 'Expected one literal versionName in app/build.gradle');
  const versionCode = Number(codes[0][1]);
  const versionName = names[0][1];
  assert.ok(Number.isSafeInteger(versionCode) && versionCode <= 2100000000, 'Invalid Android versionCode');
  assert.match(versionName, /^\d+\.\d+\.\d+(?:[-.][A-Za-z0-9]+)*$/, 'Unsafe or invalid versionName');
  assert.equal(apkMetadata.applicationId, 'community.demos', 'Unexpected Android applicationId');
  assert.equal(apkMetadata.variantName, 'debug', 'Expected compiled debug APK metadata');
  assert.equal(apkMetadata.elements?.length, 1, 'Expected one compiled APK');
  const built = apkMetadata.elements[0];
  assert.equal(built.versionCode, versionCode, 'Compiled versionCode differs from Gradle');
  assert.equal(built.versionName, versionName, 'Compiled versionName differs from Gradle');
  return { versionCode, versionName, artifactName: `demos-android-${versionName}-v${versionCode}-UNSIGNED-aab` };
}

if (require.main === module) {
  const metadata = releaseMetadata(
    fs.readFileSync('client/android/app/build.gradle', 'utf8'),
    JSON.parse(fs.readFileSync('client/android/app/build/outputs/apk/debug/output-metadata.json', 'utf8')),
  );
  console.log(`Validated compiled Android ${metadata.versionName} (${metadata.versionCode})`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `artifact_name=${metadata.artifactName}\n`);
  }
}

module.exports = { releaseMetadata };
