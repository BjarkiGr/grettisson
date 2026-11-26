/* Build the web bundle Capacitor copies into the native projects.
   The game is plain ordered scripts (no bundler needed) — we just copy
   index.html, style.css, the manifest, src/ and assets/ into www/. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const www = path.join(root, 'www');

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

for (const f of ['index.html', 'style.css', 'manifest.webmanifest']) {
  fs.copyFileSync(path.join(root, f), path.join(www, f));
}
for (const dir of ['src', 'assets']) {
  fs.cpSync(path.join(root, dir), path.join(www, dir), { recursive: true });
}
console.log('www/ built (' + fs.readdirSync(path.join(www, 'src')).length + ' scripts). Ready for `npx cap sync`.');