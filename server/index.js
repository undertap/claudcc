const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const { buildSnapshot } = require('./scan');
const { saveRating } = require('./scanners/ratings');

const WEB_ROOT = path.resolve(__dirname, '..', 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.jsx':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.map':  'application/json; charset=utf-8',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const relPath = urlPath === '/' ? '/index.html' : urlPath;
  const safePath = path.normalize(relPath).replace(/^[/\\]+/, '');
  const filePath = path.join(WEB_ROOT, safePath);

  if (!filePath.startsWith(WEB_ROOT)) {
    return sendError(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      if (!path.extname(urlPath)) {
        // SPA-ish fallback: serve index.html for any non-file GET
        return serveFile(path.join(WEB_ROOT, 'index.html'), res);
      }
      return sendError(res, 404, 'Not found');
    }
    serveFile(filePath, res);
  });
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, buf) => {
    if (err) return sendError(res, 500, err.message);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': buf.length,
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  try {
    if (req.method === 'GET' && (route === '/api/data' || route === '/api/refresh')) {
      const snapshot = await buildSnapshot();
      return sendJson(res, 200, snapshot);
    }

    if (req.method === 'POST' && route === '/api/rate') {
      const body = await readJsonBody(req);
      if (!body || typeof body.rating !== 'number') {
        return sendError(res, 400, 'rating (1-5) is required');
      }
      await saveRating(body);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && route === '/api/health') {
      return sendJson(res, 200, { ok: true, version: require('../package.json').version });
    }

    return sendError(res, 404, 'Unknown API route: ' + route);
  } catch (err) {
    console.error('[api]', route, err);
    return sendError(res, 500, err.message || String(err));
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('Invalid JSON body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

function openBrowser(url) {
  const cmds = {
    darwin: `open "${url}"`,
    win32: `start "" "${url}"`,
    linux: `xdg-open "${url}"`,
  };
  const cmd = cmds[process.platform];
  if (!cmd) return;
  exec(cmd, (err) => {
    if (err) console.log(`(Open ${url} manually — couldn't auto-launch browser)`);
  });
}

async function startServer({ port = 7337, shouldOpen = true } = {}) {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) return handleApi(req, res);
    if (req.method === 'GET') return serveStatic(req, res);
    return sendError(res, 405, 'Method not allowed');
  });

  return new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Try: cc-doctor --port ${port + 1}`);
        process.exit(1);
      }
      reject(err);
    };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      const url = `http://localhost:${port}`;
      console.log(`cc-doctor running at ${url}`);
      console.log(`(press Ctrl+C to stop)`);
      if (shouldOpen) openBrowser(url);
      resolve(server);
    });
  });
}

module.exports = { startServer };
