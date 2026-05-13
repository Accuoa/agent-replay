import { createHash } from 'node:crypto';
import { canonicalize } from './canonical.mjs';

/**
 * Encode bytes as unpadded base64url.
 */
function base64url(bytes) {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Compute the canonical hash of a JSON-serializable value.
 * Returns "sha256:" + base64url(SHA256(canonical(value))).
 */
export function hashInput(value) {
  const canonical = canonicalize(value);
  const hash = createHash('sha256').update(canonical, 'utf-8').digest();
  return 'sha256:' + base64url(hash);
}
