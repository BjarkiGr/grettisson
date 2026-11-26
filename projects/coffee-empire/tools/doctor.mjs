/* Environment doctor: checks the tooling Capacitor 7 needs and prints the
   exact fix for anything missing/outdated. Run: npm run doctor */
import { spawnSync } from 'node:child_process';

let problems = 0;
const ok = m => console.log('  ok   ' + m);
const bad = (m, fix) => { problems++; console.log('FAIL  ' + m + '\n      fix: ' + fix); };

function version(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.status === 0) return (r.stdout || '').trim();
  } catch (e) { /* not installed */ }
  return null;
}
function major(v) { return parseInt(String(v).replace(/^v/, '').split('.')[0], 10); }

console.log('Coffee Empire — environment check (Capacitor 8 requirements)');

/* Node 22+ */
const nodeV = process.version;
if (major(nodeV) >= 22) ok('Node ' + nodeV + ' (needs 22+)');
else bad('Node ' + nodeV + ' is too old (needs 22+)',
  'brew install node@22 && brew link --overwrite node@22   (or: nvm install 22 && nvm use 22)');

/* npm */
const npmV = version('npm', ['--version']);
if (npmV) ok('npm ' + npmV);
else bad('npm not found', 'reinstall Node 22 (npm ships with it)');

/* CocoaPods — OPTIONAL since Capacitor 8 (iOS uses Swift Package Manager). */
const podV = version('pod', ['--version']);
if (!podV) console.log('  --   CocoaPods not installed (optional — Capacitor 8 uses SPM, no pods needed)');
else ok('CocoaPods ' + podV + ' (optional)');

/* Xcode 26+ (macOS only, iOS builds) */
if (process.platform === 'darwin') {
  const xc = version('xcodebuild', ['-version']);
  if (!xc) bad('Xcode command line tools not found', 'install Xcode from the App Store, then: sudo xcode-select -s /Applications/Xcode.app');
  else {
    const m = xc.match(/Xcode (\d+)/);
    if (m && parseInt(m[1], 10) >= 26) ok('Xcode ' + m[1] + ' (needs 26+)');
    else bad('Xcode too old for Capacitor 8 (needs 26+)',
      'update macOS and install the latest Xcode from the App Store');
  }
} else {
  console.log('  --   Xcode check skipped (iOS builds require a Mac)');
}

console.log(problems === 0 ? '\nEnvironment OK — run: npm install && npm run build && npx cap sync'
  : '\n' + problems + ' problem(s) found — apply the fixes above, then re-run npm run doctor');
process.exit(problems === 0 ? 0 : 1);