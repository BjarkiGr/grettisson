/* One-command iOS deployment-target fix (run on the Mac):
   1. forces Podfile platform + post_install hook to iOS 15
   2. forces the App project to iOS 15
   3. regenerates Pods from scratch (pod install)
   4. force-patches any 14.0 left in the generated Pods project
   Run: npm run fix:ios   — then Clean Build Folder in Xcode. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const iosApp = path.join(root, 'ios', 'App');
const TARGET = '15.0';
const HOOK = "      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '" + TARGET + "'";

function patch(file, re, to, label) {
  if (!fs.existsSync(file)) { console.log('  --   ' + label + ' (not present, skipped)'); return 0; }
  const s = fs.readFileSync(file, 'utf8');
  const n = (s.match(re) || []).length;
  if (n) fs.writeFileSync(file, s.replace(re, to));
  console.log('  ' + (n ? 'fixed' : 'ok   ') + ' ' + label + (n ? ' (' + n + ' replaced)' : ''));
  return n;
}

console.log('1) Podfile');
const podfile = path.join(iosApp, 'Podfile');
if (!fs.existsSync(podfile)) {
  console.log('  --   SPM project (Capacitor 8) — no CocoaPods, nothing to fix here');
} else {
let pod = fs.readFileSync(podfile, 'utf8');
pod = pod.replace(/platform :ios, '[^']+'/, "platform :ios, '" + TARGET + "'");
if (pod.indexOf("config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']") < 0) {
  pod = pod.replace(/post_install do \|installer\|/,
    'post_install do |installer|\n' +
    '  installer.pods_project.targets.each do |target|\n' +
    '    target.build_configurations.each do |config|\n' +
    HOOK + '\n' +
    '    end\n' +
    '  end');
  fs.writeFileSync(podfile, pod);
  console.log('  fixed post_install hook added');
} else {
  fs.writeFileSync(podfile, pod);
  console.log('  ok   platform + hook present');
}
}

console.log('2) App project');
patch(path.join(iosApp, 'App.xcodeproj', 'project.pbxproj'),
  /IPHONEOS_DEPLOYMENT_TARGET = 14(\.0)?;/g, 'IPHONEOS_DEPLOYMENT_TARGET = ' + TARGET + ';', 'App deployment target');

if (!fs.existsSync(podfile)) {
  const pbx = path.join(iosApp, 'App.xcodeproj', 'project.pbxproj');
  const left = (fs.readFileSync(pbx, 'utf8').match(/IPHONEOS_DEPLOYMENT_TARGET = 14/g) || []).length;
  console.log(left === 0 ? '\nDONE — SPM project at iOS 15+. In Xcode: Product → Clean Build Folder (Shift+Cmd+K), then Run.'
    : '\nWARNING: ' + left + ' references remain.');
  process.exit(left === 0 ? 0 : 1);
}

console.log('3) Regenerating Pods (this can take a minute)');
fs.rmSync(path.join(iosApp, 'Pods'), { recursive: true, force: true });
fs.rmSync(path.join(iosApp, 'Podfile.lock'), { force: true });
const r = spawnSync('pod', ['install'], { cwd: iosApp, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) {
  console.log('\n pod install failed or CocoaPods is missing.');
  console.log(' Install it with: brew install cocoapods   then re-run npm run fix:ios');
  process.exit(1);
}

console.log('4) Force-patching any 14.0 left in the generated Pods project');
patch(path.join(iosApp, 'Pods', 'Pods.xcodeproj', 'project.pbxproj'),
  /IPHONEOS_DEPLOYMENT_TARGET = 14(\.0)?;/g, 'IPHONEOS_DEPLOYMENT_TARGET = ' + TARGET + ';', 'Pods deployment targets');

/* Final verification */
const podsPbx = path.join(iosApp, 'Pods', 'Pods.xcodeproj', 'project.pbxproj');
const left = fs.existsSync(podsPbx) ? (fs.readFileSync(podsPbx, 'utf8').match(/IPHONEOS_DEPLOYMENT_TARGET = 14/g) || []).length : 0;
console.log(left === 0 ? '\nDONE — no iOS 14 targets remain. In Xcode: Product → Clean Build Folder (Shift+Cmd+K), then Run.'
  : '\nWARNING: ' + left + ' references remain — paste this output for help.');
process.exit(left === 0 ? 0 : 1);