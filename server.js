// Runs xray (VLESS + WebSocket) on $PORT, configured from env.
// Env: UUID (required), WSPATH (default /ws), PORT (default 8080).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { ensureXray } = require('./setup');

const uuid = process.env.UUID;
const wsPath = process.env.WSPATH || '/ws';
const port = parseInt(process.env.PORT || '8080', 10);
if (!uuid) { console.error('UUID env required'); process.exit(1); }

(async () => {
  const bin = await ensureXray();
  const cfg = {
    log: { loglevel: 'warning' },
    inbounds: [{
      listen: '0.0.0.0', port,
      protocol: 'vless',
      settings: { clients: [{ id: uuid }], decryption: 'none' },
      streamSettings: { network: 'ws', wsSettings: { path: wsPath } },
      sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] }
    }],
    outbounds: [
      { protocol: 'freedom', tag: 'direct', settings: { domainStrategy: 'UseIPv4' } },
      { protocol: 'blackhole', tag: 'block' }
    ],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [
        { type: 'field', outboundTag: 'block', protocol: ['bittorrent'] }
      ]
    },
    dns: { servers: ['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query'], queryStrategy: 'UseIPv4' }
  };
  const cfgPath = path.join('/tmp', 'xray-' + crypto.randomBytes(4).toString('hex') + '.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  const child = spawn(bin, ['run', '-c', cfgPath], { stdio: 'inherit', cwd: __dirname });
  child.on('exit', (code) => process.exit(code || 0));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
})().catch((e) => { console.error(e); process.exit(1); });
