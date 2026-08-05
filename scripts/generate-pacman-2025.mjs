import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const YEAR = 2025;
const FROM = `${YEAR}-01-01T00:00:00.000Z`;
const TO = `${YEAR}-12-31T23:59:59.000Z`;
const END_DATE = `Date.UTC(${YEAR},11,31)`;

let pkgPath;
try {
  pkgPath = path.join(path.dirname(require.resolve('pacman-contribution-graph/package.json')), 'dist', 'pacman-contribution-graph.min.js');
} catch {
  pkgPath = process.env.PCG_MIN_JS;
}
if (!pkgPath || !fs.existsSync(pkgPath)) {
  console.error('pacman-contribution-graph not found. Run: npm install pacman-contribution-graph');
  process.exit(1);
}

const source = fs.readFileSync(pkgPath, 'utf8');

const patches = [
  {
    from: 'contributionsCollection {',
    to: `contributionsCollection(from: \\"${FROM}\\", to: \\"${TO}\\") {`
  },
  {
    from: `l=t=>{const e=r(new Date),n=(t=>t.contributions.reduce(((t,e)=>{const n=r(new Date(e.date));return void 0===t||n>t?n:t}),void 0))(t);return n&&n>e?n:e}`,
    to: `l=t=>r(new Date(${END_DATE}))`
  },
  {
    from: 'q=author:${t.config.username}',
    to: 'q=author:${t.config.username}+committer-date:' + `${YEAR}-01-01..${YEAR}-12-31`
  }
];

let patched = source;
for (const p of patches) {
  if (!patched.includes(p.from)) {
    console.error(`Patch target not found: ${p.from.slice(0, 60)}...`);
    process.exit(1);
  }
  patched = patched.split(p.from).join(p.to);
}

const outDir = path.join(__dirname, '..', 'dist');
fs.mkdirSync(outDir, { recursive: true });

const patchedPath = path.join(outDir, 'pacman-contribution-graph.2025.min.mjs');
fs.writeFileSync(patchedPath, patched);

const mod = await import(pathToFileURL(patchedPath).href);
const { ArcadeRenderer } = mod;

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

const configs = [
  { theme: 'github', file: 'pacman-contribution-graph.svg' },
  { theme: 'github-dark', file: 'pacman-contribution-graph-dark.svg' }
];

for (const { theme, file } of configs) {
  await new Promise((resolve, reject) => {
    const renderer = new ArcadeRenderer({
      game: 'pacman',
      platform: 'github',
      username: process.env.GITHUB_USER || 'VidalLuyo',
      gameTheme: theme,
      githubSettings: { accessToken: token },
      svgCallback: (svg) => {
        fs.writeFileSync(path.join(outDir, file), svg);
        console.log(`SVG saved to ${path.join('dist', file)} (${theme})`);
        resolve();
      },
      gameOverCallback: () => {}
    });
    renderer.start().catch(reject);
  });
}

fs.unlinkSync(patchedPath);
console.log('Done. Verifying durMax...');
