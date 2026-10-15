import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const EXPECTED_PROJECT_ID = 'demos-finale';
const EXPECTED_PACKAGE_NAME = 'community.demos';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(scriptDir, '..');
const googleServicesPath = path.join(clientDir, 'android', 'app', 'google-services.json');

async function validateGoogleServices() {
  let raw;
  try {
    raw = await readFile(googleServicesPath, 'utf8');
  } catch {
    throw new Error(`Missing ${googleServicesPath}. Download the canonical Firebase Android config before enabling native push.`);
  }

  const config = JSON.parse(raw);
  if (config?.project_info?.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error(`Unexpected Firebase project: ${config?.project_info?.project_id || 'missing'} (expected ${EXPECTED_PROJECT_ID}).`);
  }

  const matchingClient = Array.isArray(config?.client)
    ? config.client.find((entry) => entry?.client_info?.android_client_info?.package_name === EXPECTED_PACKAGE_NAME)
    : null;

  if (!matchingClient) {
    throw new Error(`google-services.json does not contain Android package ${EXPECTED_PACKAGE_NAME}.`);
  }

  if (!matchingClient?.client_info?.mobilesdk_app_id) {
    throw new Error('google-services.json is missing mobilesdk_app_id for the Android app.');
  }
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: clientDir,
      env,
      stdio: 'inherit',
      windowsHide: true,
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

await validateGoogleServices();

const env = {
  ...process.env,
  VITE_ANDROID_NATIVE_PUSH_ENABLED: 'true',
};
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log(`Native Android push build enabled for ${EXPECTED_PACKAGE_NAME} on ${EXPECTED_PROJECT_ID}.`);
await run(npmCommand, ['run', 'build'], env);
await run(npxCommand, ['cap', 'sync', 'android'], env);
