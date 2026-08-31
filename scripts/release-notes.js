/**
 * Extract one Keep a Changelog release section for GitHub Release notes.
 * Usage: node scripts/release-notes.js 1.1.1
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rawVersion = process.argv[2];
const version = String(rawVersion || '').replace(/^v/, '');

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/release-notes.js <major.minor.patch>');
  process.exit(1);
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');
const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s+-[^\\n]*)?\\s*$`, 'm');
const match = changelog.match(heading);

if (!match || typeof match.index !== 'number') {
  console.error(`No changelog section found for v${version}.`);
  process.exit(1);
}

const bodyStart = match.index + match[0].length;
const remaining = changelog.slice(bodyStart);
const nextHeadingOffset = remaining.search(/^## \[/m);
const bodyEnd = nextHeadingOffset === -1 ? changelog.length : bodyStart + nextHeadingOffset;
const body = changelog
  .slice(bodyStart, bodyEnd)
  .replace(/^\[[^\]]+\]:\s+\S+\s*$/gm, '')
  .replace(/\n---\s*$/m, '')
  .trim();

if (!body || !/^###\s+/m.test(body)) {
  console.error(`Changelog section for v${version} is empty or has no release categories.`);
  process.exit(1);
}

process.stdout.write(`${body}\n`);
