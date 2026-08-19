import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(mobileRoot, relativePath), 'utf8');

const appConfig = JSON.parse(read('app.json')).expo;
const iosUsage = appConfig.ios?.infoPlist || {};
const android = appConfig.android || {};
const blocked = new Set(android.blockedPermissions || []);
const declared = new Set(android.permissions || []);
const hasAndroidPermission = (permission) => (
  declared.has(permission) ||
  declared.has(permission.replace('android.permission.', ''))
);
const nativeManifest = read('android/app/src/main/AndroidManifest.xml');
const expenseScreen = read('app/more/expenses.tsx');
const jobScreen = read('app/job/[id].tsx');
const mapScreen = read('app/(tabs)/map.tsx');
const locationTracking = read('src/lib/location-tracking.ts');
const sentry = read('src/lib/sentry.ts');
const appLayout = read('app/_layout.tsx');

assert.match(iosUsage.NSCameraUsageDescription || '', /photo|camera/i);
assert.match(iosUsage.NSPhotoLibraryUsageDescription || '', /photo|library/i);
assert.match(iosUsage.NSMicrophoneUsageDescription || '', /video|audio|microphone/i);
assert.equal(iosUsage.NSPhotoLibraryAddUsageDescription, undefined);

for (const permission of [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
]) {
  assert.ok(hasAndroidPermission(permission), `Missing Android permission: ${permission}`);
}
for (const permission of [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]) {
  assert.ok(blocked.has(permission), `Legacy storage permission is not blocked: ${permission}`);
  assert.ok(!nativeManifest.includes(permission), `Legacy storage permission is still in the native manifest: ${permission}`);
}

assert.match(expenseScreen, /requestCameraPermissionsAsync\(\)/);
assert.match(expenseScreen, /launchCameraAsync\(/);
assert.match(expenseScreen, /requestMediaLibraryPermissionsAsync\(\)/);
assert.match(expenseScreen, /launchImageLibraryAsync\(/);

assert.match(jobScreen, /getDocumentPicker\(\)/);
assert.match(jobScreen, /getDocumentAsync\(/);
assert.match(jobScreen, /Camera\.Camera\.requestMicrophonePermissionsAsync\(\)/);
assert.doesNotMatch(jobScreen, /microphonePermission\s*=\s*await\s+ImagePicker\.requestMediaLibraryPermissionsAsync/);

assert.match(mapScreen, /requestForegroundPermissionsAsync\(\)/);
assert.match(locationTracking, /requestForegroundPermissionsAsync\(\)/);
assert.match(locationTracking, /requestBackgroundPermissionsAsync\(\)/);

assert.match(sentry, /attachScreenshot:\s*false/);
assert.match(sentry, /Sentry\.setUser\(\{\s*id:\s*user\.id,\s*\}\)/s);
assert.doesNotMatch(sentry, /Sentry\.setUser\(\{[^}]*\b(email|username):/s);
assert.match(appLayout, /setSentryUser\(\{\s*id:\s*user\.id\s*\}\)/);

console.log('Mobile security and permission checks: 29 assertions passed');