import { readFileSync, mkdirSync, rmSync, cpSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';
const manifest = JSON.parse(readFileSync('manifest.json'));
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/extension', { recursive: true });
for (const path of ['manifest.json', 'popup.html', 'popup.css', 'src', 'icons']) cpSync(path, join('dist/extension', path), { recursive: true });
const files = {};
function walk(dir) { for (const entry of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, entry.name); if (entry.isDirectory()) walk(path); else files[relative('dist/extension', path).replaceAll('\\', '/')] = new Uint8Array(readFileSync(path)); } }
walk('dist/extension');
const path = `dist/youtube-music-hide-video-custom-themes-v${manifest.version}.zip`;
writeFileSync(path, zipSync(files, { level: 9 }));
console.log(`Packaged ${Object.keys(files).length} files → ${path}`);
