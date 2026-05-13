/**
 * Deep-canonicalize a value for deterministic JSON serialization (RFC 8785 JCS).
 * Recursively sorts object keys. Preserves array element order.
 * Returns a JSON string. Maps undefined to 'null' so the output is always
 * valid JSON (consistent with JSON.stringify semantics for top-level undefined,
 * but here surfaced explicitly so downstream hashers don't choke).
 */
export function canonicalize(value) {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
