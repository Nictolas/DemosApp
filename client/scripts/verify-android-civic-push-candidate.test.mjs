import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {
  assertFirebaseAndroidConfig,
  assertAndroidPushSourceContract,
  assertCompiledPushEvidence,
} from './verify-android-civic-push-candidate.mjs';

const clientRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=rel=>readFile(path.join(clientRoot,rel),'utf8');
const validConfig={
  project_info:{project_id:'demos-finale'},
  client:[{client_info:{android_client_info:{package_name:'community.demos'},
    mobilesdk_app_id:'synthetic-not-a-real-google-app'}}]
};

test('only one canonical Android Firebase app and project pass',()=>{
  assert.deepEqual(assertFirebaseAndroidConfig(validConfig),
    {project:'demos-finale',packageName:'community.demos'});
  const invalid=[
    null,{},[],
    {...validConfig,project_info:{project_id:'other-project'}},
    {...validConfig,client:[]},
    {...validConfig,client:[{client_info:{android_client_info:{
      package_name:'community.demos.fake'},mobilesdk_app_id:'synthetic'}}]},
    {...validConfig,client:[validConfig.client[0],validConfig.client[0]]},
    {...validConfig,client:[{client_info:{android_client_info:{
      package_name:'community.demos'}}}]},
  ];
  for(const cfg of invalid)
    assert.throws(()=>assertFirebaseAndroidConfig(cfg),/^Error: ANDROID_PUSH_/);
});

test('repository native push is gated and routes tap to app',async()=>{
  const src={
    helper:await load('scripts/build-android-native-push.mjs'),
    nativePush:await load('src/lib/native-push.ts'),
    nativeHook:await load('src/hooks/useNativePush.ts'),
    syncHook:await load('src/hooks/useSyncFcmToken.ts'),
    gradle:await load('android/app/build.gradle'),
    capacitorGradle:await load('android/app/capacitor.build.gradle'),
  };
  assert.equal(assertAndroidPushSourceContract(src),true);
  for(const [key,broken] of [
    ['helper','export const placeholder = true;'],
    ['nativePush','export function isNativePushEnabled(){return false}'],
    ['nativeHook','export function useNativePush(){return null}'],
    ['syncHook','export function useSyncFcmToken(){return null}'],
    ['gradle','apply plugin: android'],
    ['capacitorGradle','// plugin removed'],
  ]) {
    assert.throws(()=>assertAndroidPushSourceContract({...src,[key]:broken}),
      /^Error: ANDROID_PUSH_/);
  }
});

test('compiled Android assets require token, tap action, registration markers',()=>{
  assert.equal(assertCompiledPushEvidence([
    'registrationError','pushNotificationActionPerformed','demos_native_push_token',
  ]),true);
  for(const bad of [
    [],['registrationError','pushNotificationActionPerformed'],
    ['demos_native_push_token','registrationError'],
    ['demos_native_push_token','pushNotificationActionPerformed'],
    null,[''],
  ]) assert.throws(()=>assertCompiledPushEvidence(bad),/ANDROID_PUSH_/);
});
