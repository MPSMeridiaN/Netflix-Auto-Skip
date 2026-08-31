/**
 * Static release audit with no third-party dependencies.
 * Runtime behavior is covered by qa-dryrun-test.js; this script checks the
 * manifest, version surfaces, permissions, release files, and public claims.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const packageJson = readJson('package.json');
const manifest = readJson('manifest.json');
const version = manifest.version;

assert.ok(/^\d+\.\d+\.\d+$/.test(version), `Invalid manifest version: ${version}`);
assert.strictEqual(packageJson.version, version, 'package.json and manifest.json versions must match');
assert.deepStrictEqual(manifest.permissions, ['storage'], 'Permissions must remain minimized');
assert.deepStrictEqual(manifest.host_permissions, ['https://www.netflix.com/*'], 'Host permission must remain minimized');

const contentScript = manifest.content_scripts && manifest.content_scripts[0];
assert.ok(contentScript, 'Manifest must define the content script');
assert.deepStrictEqual(contentScript.matches, ['https://www.netflix.com/*'], 'Content matches must match host permission');
assert.deepStrictEqual(contentScript.js, [
  'shared/constants.js',
  'shared/storage.js',
  'content/engine.js',
  'content/content.js'
], 'Content script load order must include the production engine');

const requiredFiles = [
  'shared/constants.js',
  'shared/storage.js',
  'content/engine.js',
  'content/content.js',
  'content/content.css',
  'assets/infographic.png',
  'background/service-worker.js',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'README.md',
  'CHANGELOG.md',
  'docs/ARCHITECTURE.md',
  'LICENSE'
];
for (const relativePath of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `Missing required release file: ${relativePath}`);
}

const readme = readText('README.md');
const storeGuide = readText('CHROMEWEBSTORE.md');
const architecture = readText('docs/ARCHITECTURE.md');
const popup = readText('popup/popup.html');
const engine = readText('content/engine.js');
const serviceWorker = readText('background/service-worker.js');

assert.ok(readme.includes(`netflix-auto-skip-v${version}.zip`), 'README release link must use the current version');
assert.ok(storeGuide.includes(`- **Version**: ${version}`), 'Store guide version must match the manifest');
assert.ok(popup.includes(`v${version}`), 'Popup version must match the manifest');
assert.ok(readme.includes('No telemetry, analytics, remote backend, or extension-initiated external network requests.'));
assert.ok(storeGuide.includes('No telemetry, analytics, remote backend, or extension-initiated external network requests.'));
assert.ok(architecture.includes('canonical route identity'));
assert.ok(engine.includes('recognized Netflix player context'));
assert.ok(serviceWorker.includes("importScripts('../shared/constants.js', '../shared/storage.js')"));

for (const [label, text] of [
  ['README', readme],
  ['Chrome Web Store guide', storeGuide],
  ['Architecture document', architecture],
  ['Popup', popup]
]) {
  assert.ok(!/100%\s+(?:offline|private)/i.test(text), `${label} contains an absolute offline/private claim`);
  assert.ok(!/cannot\s+(?:read|access).*?(?:password|cookie|payment|account)/i.test(text), `${label} contains an absolute account-data claim`);
}

assert.ok(!/startsWith\(['"]\/watch/.test(engine), 'Engine must not use a broad watch-route prefix check');
assert.ok(!/Boolean\(document\.querySelector\(['"]video['"]\)\)/.test(engine), 'Engine must not use a page-wide video fallback');
assert.ok(!/RECORD_SKIP|GET_CONFIG/.test(`${engine}\n${serviceWorker}`), 'Dead message paths must not return');
assert.ok(!/eval\s*\(/.test(`${engine}\n${serviceWorker}`), 'Release code must not use eval');

const distDir = path.join(root, 'dist');
if (fs.existsSync(distDir)) {
  const expectedArchive = `netflix-auto-skip-v${version}.zip`;
  for (const name of fs.readdirSync(distDir)) {
    if (name.endsWith('.zip')) assert.strictEqual(name, expectedArchive, `Stale release archive found: ${name}`);
  }
}

console.log(`Release source audit passed for v${version}.`);
