// Release gate for a push-enabled Android test candidate. No FCM send,
// no publication, no provider calls, and no printing Firebase configuration.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const CLIENT_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const EXPECTED_PROJECT='demos-finale';
const EXPECTED_PACKAGE='community.demos';

export function assertFirebaseAndroidConfig(config) {
  if (!config || typeof config!=='object' || Array.isArray(config) ||
      config.project_info?.project_id!==EXPECTED_PROJECT) {
    throw new Error('ANDROID_PUSH_WRONG_FIREBASE_PROJECT');
  }
  const candidates=Array.isArray(config.client)?config.client:[];
  const matching=candidates.filter(x=>
    x?.client_info?.android_client_info?.package_name===EXPECTED_PACKAGE);
  if (matching.length!==1 ||
      !matching[0]?.client_info?.mobilesdk_app_id) {
    throw new Error('ANDROID_PUSH_WRONG_PACKAGE_OR_APP_ID');
  }
  return {project:EXPECTED_PROJECT,packageName:EXPECTED_PACKAGE};
}

export function assertAndroidPushSourceContract(sources) {
  if (!/VITE_ANDROID_NATIVE_PUSH_ENABLED:\s*'true'/.test(sources.helper) ||
      !sources.helper.includes('await validateGoogleServices()') ||
      !sources.helper.includes("['run', 'build']") ||
      !sources.helper.includes("['cap', 'sync', 'android']")) {
    throw new Error('ANDROID_PUSH_BUILD_HELPER_NOT_GUARDED');
  }
  if (!sources.nativePush.includes("VITE_ANDROID_NATIVE_PUSH_ENABLED === 'true'") ||
      !sources.nativeHook.includes("pushNotificationActionPerformed") ||
      !sources.nativeHook.includes("openNotificationTarget(action)") ||
      !sources.syncHook.includes("transport === 'native'")) {
    throw new Error('ANDROID_PUSH_NATIVE_BRIDGE_MISSING');
  }
  if (!sources.gradle.includes("apply plugin: 'com.google.gms.google-services'") ||
      !sources.gradle.includes("file('google-services.json')")) {
    throw new Error('ANDROID_PUSH_GOOGLE_SERVICES_GRADLE_MISSING');
  }
  if (!sources.capacitorGradle.includes('capacitor-push-notifications')) {
    throw new Error('ANDROID_PUSH_PLUGIN_MISSING');
  }
  return true;
}

export function assertCompiledPushEvidence(chunks) {
  if (!Array.isArray(chunks) || chunks.length===0) {
    throw new Error('ANDROID_PUSH_COMPILED_JS_MISSING');
  }
  const bundle=chunks.join('\n');
  if (!bundle.includes('pushNotificationActionPerformed') ||
      !bundle.includes('demos_native_push_token') ||
      !bundle.includes('registrationError')) {
    throw new Error('ANDROID_PUSH_COMPILED_BRIDGE_MISSING');
  }
  return true;
}

export async function verifyCandidate({root=CLIENT_ROOT,compiled=false}={}) {
  const load=rel=>readFile(path.join(root,rel),'utf8');
  let cfg;
  try { cfg=JSON.parse(await load('android/app/google-services.json')); }
  catch { throw new Error('ANDROID_PUSH_FIREBASE_CONFIG_MISSING_OR_INVALID'); }
  const target=assertFirebaseAndroidConfig(cfg);
  const sources={
    helper:await load('scripts/build-android-native-push.mjs'),
    nativePush:await load('src/lib/native-push.ts'),
    nativeHook:await load('src/hooks/useNativePush.ts'),
    syncHook:await load('src/hooks/useSyncFcmToken.ts'),
    gradle:await load('android/app/build.gradle'),
    capacitorGradle:await load('android/app/capacitor.build.gradle'),
  };
  assertAndroidPushSourceContract(sources);
  if (compiled) {
    const copied=path.join(root,'android/app/src/main/assets/public/assets');
    let files;
    try {files=(await readdir(copied)).filter(f=>f.endsWith('.js'));}
    catch {throw new Error('ANDROID_PUSH_COMPILED_ASSETS_MISSING');}
    const chunks=await Promise.all(files.map(f=>readFile(path.join(copied,f),'utf8')));
    assertCompiledPushEvidence(chunks);
  }
  return target;
}

const invoked=process.argv[1]&&
  path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if (invoked) {
  const stage=process.argv[2];
  if (stage!=='--config' && stage!=='--built') {
    console.error('Usage: node verify-android-civic-push-candidate.mjs --config|--built');
    process.exitCode=2;
  } else {
    verifyCandidate({compiled:stage==='--built'}).then(x=>{
      // Never print config JSON, keys, tokens or the path to a local secret.
      console.log('Android native push '+(stage==='--built'?'compiled':'configuration')+
        ' validated for '+x.packageName+' (no FCM send, no Play release)');
    }).catch(err=>{
      console.error(err?.message?.startsWith('ANDROID_PUSH_')?
        err.message:'ANDROID_PUSH_CANDIDATE_INVALID');
      process.exitCode=1;
    });
  }
}
