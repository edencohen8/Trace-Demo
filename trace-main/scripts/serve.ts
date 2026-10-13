import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createApi } from '../src/server/api.ts';
import { APP_ROOT } from '../src/server/config.ts';

const production = process.argv.includes('--production');
const api = createApi();
const vite = production ? undefined : await (await import('vite')).createServer({ root: APP_ROOT, server: { middlewareMode: true } });
const dist = resolve(APP_ROOT, 'dist');
const server = createServer(async (request, response) => {
  try {
    const hostname = (request.headers.host ?? '').split(':')[0];
    if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) { response.writeHead(403); response.end('Local demo only'); return; }
    if (await api(request, response)) return;
    const requestedPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    if (/(?:^|\/)\.(?:env(?:\.[^/]*)?|state|git)(?:\/|$)/.test(requestedPath) || requestedPath.includes('/radar-simulator/')) {
      response.writeHead(403); response.end('Private application data'); return;
    }
    if (vite) { vite.middlewares(request, response); return; }
    const pathname = requestedPath;
    let file = resolve(dist, `.${pathname}`);
    if (file !== dist && !file.startsWith(`${dist}${sep}`)) { response.writeHead(403); response.end(); return; }
    try { if (!(await stat(file)).isFile()) file = resolve(dist, 'index.html'); }
    catch { if (extname(pathname)) { response.writeHead(404); response.end(); return; } file = resolve(dist, 'index.html'); }
    const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end('Server error');
  }
});
const port = Number(process.env.PORT || 5180);
server.listen(port, '127.0.0.1', () => console.log(`TRACE ${production ? 'demo' : 'development'} ready: http://127.0.0.1:${port}`));
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; void vite?.close(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.close(); void vite?.close().then(() => process.exit(0)); if (!vite) process.exit(0); });
