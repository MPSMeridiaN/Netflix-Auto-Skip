/**
 * Synchronize release version surfaces and promote CHANGELOG.md's Unreleased section.
 * Usage: node scripts/prepare-release.js X.Y.Z [YYYY-MM-DD]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rawVersion = process.argv[2];
const version = String(rawVersion || '').replace(/^v/, '');
const releaseDate = process.argv[3] || process.env.RELEASE_DATE || new Date().toISOString().slice(0, 10);
const versionPattern = /^(\d+)\.(\d+)\.(\d+)$/;

const fail = (message) => {
  console.error(`Release preparation failed: ${message}`);
  process.exit(1);
};

if (!versionPattern.test(version)) fail('version must use major.minor.patch format');
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) fail('date must use YYYY-MM-DD format');

const parseVersion = (value) => value.split('.').map(Number);
const compareVersions = (left, right) => {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
};

const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const updates = new Map();

const stageText = (relativePath, nextText) => {
  updates.set(relativePath, nextText.replace(/\r\n/g, '\n'));
};

const stageJson = (relativePath, value) => {
  stageText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
};

const replaceOnce = (relativePath, pattern, replacement, description, expectedMatches = 1) => {
  const current = readText(relativePath);
  const matches = current.match(pattern);
  if (!matches || matches.length !== expectedMatches) {
    fail(`expected exactly ${expectedMatches} ${description} in ${relativePath}`);
  }
  stageText(relativePath, current.replace(pattern, replacement));
};

const packageJson = JSON.parse(readText('package.json'));
const manifest = JSON.parse(readText('manifest.json'));
if (packageJson.version !== manifest.version) {
  fail(`package.json (${packageJson.version}) and manifest.json (${manifest.version}) are already out of sync`);
}
if (compareVersions(version, packageJson.version) <= 0) {
  fail(`target v${version} must be newer than current v${packageJson.version}`);
}
const previousVersion = packageJson.version;

packageJson.version = version;
manifest.version = version;
stageJson('package.json', packageJson);
stageJson('manifest.json', manifest);

replaceOnce(
  'README.md',
  /netflix-auto-skip-v\d+\.\d+\.\d+\.zip/g,
  `netflix-auto-skip-v${version}.zip`,
  'release ZIP link occurrence',
  2
);
replaceOnce(
  'CHROMEWEBSTORE.md',
  /(- \*\*Version\*\*:\s*)\d+\.\d+\.\d+/g,
  `$1${version}`,
  'store-guide version'
);
replaceOnce(
  'popup/popup.html',
  /(\bpro-badge\b[^>]*>\s*)v\d+\.\d+\.\d+/g,
  `$1v${version}`,
  'popup version badge'
);

const changelog = readText('CHANGELOG.md').replace(/\r\n/g, '\n');
const unreleasedHeading = /^## \[Unreleased\]\s*$/m;
const unreleasedMatch = changelog.match(unreleasedHeading);
let nextChangelog;

const releaseTemplate = [
  '### Added',
  '',
  '### Changed',
  '',
  '### Fixed',
  ''
].join('\n');

if (unreleasedMatch && typeof unreleasedMatch.index === 'number') {
  const bodyStart = unreleasedMatch.index + unreleasedMatch[0].length;
  const remaining = changelog.slice(bodyStart);
  const nextHeadingOffset = remaining.search(/^## \[/m);
  const bodyEnd = nextHeadingOffset === -1 ? changelog.length : bodyStart + nextHeadingOffset;
  let body = changelog.slice(bodyStart, bodyEnd)
    .replace(/_Changes for the next release go here\. Run `npm run release:prepare -- <version>` to promote this section\._\s*/m, '')
    .replace(/\n---\s*$/m, '')
    .trim();
  if (!body) body = releaseTemplate;

  const replacement = [
    '## [Unreleased]',
    '',
    '_Changes for the next release go here. Run `npm run release:prepare -- <version>` to promote this section._',
    '',
    '---',
    '',
    `## [${version}] - ${releaseDate}`,
    '',
    body,
    '',
    '---',
    ''
  ].join('\n');
  nextChangelog = `${changelog.slice(0, unreleasedMatch.index)}${replacement}${changelog.slice(bodyEnd)}`;
} else {
  const firstVersionHeading = changelog.search(/^## \[/m);
  if (firstVersionHeading === -1) fail('CHANGELOG.md has no version heading');
  const block = [
    '## [Unreleased]',
    '',
    '_Changes for the next release go here. Run `npm run release:prepare -- <version>` to promote this section._',
    '',
    '---',
    '',
    `## [${version}] - ${releaseDate}`,
    '',
    releaseTemplate,
    '',
    '---',
    ''
  ].join('\n');
  nextChangelog = `${changelog.slice(0, firstVersionHeading)}${block}${changelog.slice(firstVersionHeading)}`;
}
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const updateChangelogLink = (text, label, url) => {
  const pattern = new RegExp(`^\\[${escapeRegExp(label)}\\]:\\s+.*$`, 'm');
  const replacement = `[${label}]: ${url}`;
  if (pattern.test(text)) return text.replace(pattern, replacement);
  return `${text.trimEnd()}\n${replacement}\n`;
};
nextChangelog = updateChangelogLink(
  nextChangelog,
  'unreleased',
  `https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v${version}...HEAD`
);
nextChangelog = updateChangelogLink(
  nextChangelog,
  version,
  `https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v${previousVersion}...v${version}`
);
stageText('CHANGELOG.md', nextChangelog);

const storeGuide = updates.get('CHROMEWEBSTORE.md') || readText('CHROMEWEBSTORE.md');
if (!storeGuide.includes(`- **${version}**`)) {
  const historyHeading = '## Version History';
  const historyIndex = storeGuide.indexOf(historyHeading);
  if (historyIndex === -1) fail('CHROMEWEBSTORE.md has no Version History section');
  const insertAt = storeGuide.indexOf('\n', historyIndex) + 1;
  const entry = `- **${version}** (${releaseDate}): See [CHANGELOG.md](CHANGELOG.md) for release details.\n`;
  stageText('CHROMEWEBSTORE.md', `${storeGuide.slice(0, insertAt)}\n${entry}${storeGuide.slice(insertAt)}`);
}

for (const [relativePath, contents] of updates) {
  fs.writeFileSync(path.join(root, relativePath), contents, 'utf8');
}

console.log(`Prepared v${version} dated ${releaseDate}.`);
console.log('Review the promoted CHANGELOG.md section, then run npm run build before tagging.');
