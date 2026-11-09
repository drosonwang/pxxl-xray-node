// Ensures the official xray binary is present in this directory.
// Downloads the latest Xray-linux-64 release from the official XTLS
// Xray-core GitHub repo and extracts it. No other network access.
const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');

const BIN = path.join(__dirname, 'xray');
const API = 'https://api.github.com/repos/XTLS/Xray-core/releases/latest';
const LATEST_DL = 'https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip';

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'pxxl-xray-setup', 'Accept': 'application/vnd.github+json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return getJSON(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('GitHub API HTTP ' + res.statusCode));
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'pxxl-xray-setup' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        f.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('download HTTP ' + res.statusCode));
      res.pipe(f);
      f.on('finish', () => f.close(resolve));
    }).on('error', reject);
  });
}

async function resolveAssetUrl() {
  try {
    const rel = await getJSON(API);
    const asset = (rel.assets || []).find((a) => a.name === 'Xray-linux-64.zip');
    if (asset && asset.browser_download_url) return asset.browser_download_url;
  } catch (e) {
    console.error('GitHub API failed, using latest redirect:', e.message);
  }
  return LATEST_DL;
}

function extract(zipPath, cwd) {
  try {
    execSync('unzip -o -q ' + JSON.stringify(zipPath), { cwd, stdio: 'inherit' });
    return fs.existsSync(path.join(cwd, 'xray'));
  } catch (e) {
    return false;
  }
}

async function ensureXray() {
  if (fs.existsSync(BIN)) return BIN;
  const url = await resolveAssetUrl();
  const zipPath = path.join(__dirname, 'xray.zip');
  await download(url, zipPath);
  let ok = extract(zipPath, __dirname);
  if (!ok) {
    execSync('python3 -c "import zipfile; zipfile.ZipFile(' + JSON.stringify(zipPath) + ').extractall(' + JSON.stringify(__dirname) + ')"', { stdio: 'inherit' });
  }
  if (!fs.existsSync(BIN)) throw new Error('xray binary missing after extract');
  execSync('chmod +x ' + JSON.stringify(BIN), { stdio: 'inherit' });
  try { fs.unlinkSync(zipPath); } catch (e) {}
  for (const f of ['LICENSE', 'README.md']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) {} }
  return BIN;
}

if (require.main === module) {
  ensureXray().then(() => console.log('setup ok')).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { ensureXray };
