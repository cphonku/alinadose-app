// Builds the shareable online preview: an Expo web export rewritten to work
// as a claude.ai Artifact (files served next to the page, possibly under a
// sub-path, inside a sandboxed frame).
//
//   npm run build:preview
//
// Output: dist-preview/
//   lutealine-preview.html  the Artifact page (body content only; the host adds the skeleton)
//   files.json              { publishedPath: sourcePath } for the Artifact `files` map
//   bundle/…, assets/…      JS bundle (Expo's _expo/ renamed), fonts, images

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'dist-preview';
const PAGE = 'lutealine-preview.html';
const MAX_FILES = 255;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

// 1. Export the web build with preview mode on.
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
const exported = spawnSync(
  process.execPath,
  ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'],
  { stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_PREVIEW: '1' } },
);
if (exported.status !== 0) process.exit(exported.status ?? 1);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// 2. Make the bundle's root-absolute URLs relative (resolved against <base>, see
//    below). The Artifact service reserves names starting with "_", so _expo/
//    becomes bundle/.
const BUNDLE_DIR = 'bundle';
renameSync(join(OUT, '_expo'), join(OUT, BUNDLE_DIR));
const jsFiles = walk(join(OUT, BUNDLE_DIR)).filter((f) => f.endsWith('.js'));
for (const file of jsFiles) {
  const src = readFileSync(file, 'utf8');
  const out = src.replaceAll('"/assets/', '"assets/').replaceAll('"/_expo/', `"${BUNDLE_DIR}/`);
  writeFileSync(file, out);
}

// 3. Write the Artifact page.
const indexHtml = readFileSync(join(OUT, 'index.html'), 'utf8');
const entryFile = indexHtml.match(/src="\/_expo\/(static\/js\/web\/entry-[^"]+\.js)"/)?.[1];
if (!entryFile) throw new Error('Entry bundle not found in index.html');
const entry = `${BUNDLE_DIR}/${entryFile}`;

const page = `<title>Alinadose</title>
<style>
  /* The app draws its own light UI; the page only frames it. Single theme by choice. */
  :root {
    --frame: #fce1b8;
    --app: #fff8ef;
    --ink: #21100a;
    color-scheme: light;
  }
  html, body { height: 100%; }
  body { background: var(--frame); color: var(--ink); overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
  .boot { margin: auto; font: 15px/1.4 system-ui, sans-serif; color: var(--ink); }
</style>
<div id="root"><p class="boot">Loading Alinadose…</p></div>
<script>
  (function () {
    // Files are published next to this page, maybe under a sub-path. Pin relative
    // URLs to this folder, then reset the path so the app's router starts at "/".
    var here = new URL('.', location.href).href;
    var base = document.createElement('base');
    base.href = here;
    document.head.prepend(base);
    try { history.replaceState(null, '', '/'); } catch (e) {}
    var s = document.createElement('script');
    s.src = here + ${JSON.stringify(entry)};
    s.defer = true;
    document.body.appendChild(s);
  })();
</script>
`;
writeFileSync(join(OUT, PAGE), page);

// 4. Files map for the Artifact publish, with limit checks.
const skip = new Set([PAGE, 'index.html', 'metadata.json', 'files.json', 'favicon.ico']);
const files = {};
let total = 0;
for (const file of walk(OUT)) {
  const published = relative(OUT, file).split(sep).join('/');
  if (skip.has(published)) continue;
  const size = statSync(file).size;
  if (size > MAX_FILE_BYTES) throw new Error(`${published} is too large for an Artifact (${size} bytes)`);
  files[published] = `${OUT}/${published}`;
  total += size;
}
const count = Object.keys(files).length;
if (count > MAX_FILES) throw new Error(`Too many files for one publish: ${count}`);
writeFileSync(join(OUT, 'files.json'), JSON.stringify(files, null, 2));
console.log(`\nPreview ready: ${OUT}/${PAGE} + ${count} files (${(total / 1024 / 1024).toFixed(1)} MB)`);
