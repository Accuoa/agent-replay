import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function createAuditedFetch({ logPath, internalHosts, baseFetch = globalThis.fetch }) {
  mkdirSync(dirname(logPath), { recursive: true });
  const internalSet = new Set(internalHosts);

  return async function auditedFetch(url, init = {}) {
    const target = new URL(url);
    const internal = internalSet.has(target.hostname);
    const method = (init.method || 'GET').toUpperCase();
    const ts = new Date().toISOString();

    try {
      const res = await baseFetch(url, init);
      appendFileSync(
        logPath,
        JSON.stringify({ ts, method, url: target.toString(), internal, status: res.status }) + '\n',
        'utf-8',
      );
      return res;
    } catch (err) {
      appendFileSync(
        logPath,
        JSON.stringify({
          ts,
          method,
          url: target.toString(),
          internal,
          error: true,
          error_message: String(err.message ?? err),
        }) + '\n',
        'utf-8',
      );
      throw err;
    }
  };
}

export function truncateAuditLog(logPath) {
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, '', 'utf-8');
}

export function countExternalCalls(logPath) {
  if (!existsSync(logPath)) return 0;
  const raw = readFileSync(logPath, 'utf-8');
  return raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((e) => e.internal === false).length;
}
