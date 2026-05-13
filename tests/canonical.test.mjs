import { describe, it, expect } from 'vitest';
import { canonicalize } from '../src/canonical.mjs';

describe('canonicalize', () => {
  it('sorts object keys lexicographically', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('preserves array element order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('recursively canonicalizes nested objects', () => {
    expect(canonicalize({ x: { b: 1, a: 2 }, y: [{ d: 4, c: 3 }] }))
      .toBe('{"x":{"a":2,"b":1},"y":[{"c":3,"d":4}]}');
  });

  it('handles null and primitives', () => {
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize('hello')).toBe('"hello"');
  });

  it('produces byte-identical output for equivalent inputs', () => {
    const a = canonicalize({ a: 1, b: { x: 1, y: 2 } });
    const b = canonicalize({ b: { y: 2, x: 1 }, a: 1 });
    expect(a).toBe(b);
  });
});
