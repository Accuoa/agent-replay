import { describe, it, expect } from 'vitest';
import { hashInput } from '../src/hash.mjs';

describe('hashInput', () => {
  it('produces sha256:<base64url> prefix', () => {
    const h = hashInput({ a: 1 });
    expect(h).toMatch(/^sha256:[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same input', () => {
    expect(hashInput({ a: 1, b: 2 })).toBe(hashInput({ a: 1, b: 2 }));
  });

  it('produces identical hash for inputs differing only in key order', () => {
    expect(hashInput({ a: 1, b: 2 })).toBe(hashInput({ b: 2, a: 1 }));
  });

  it('differs across different inputs', () => {
    expect(hashInput({ a: 1 })).not.toBe(hashInput({ a: 2 }));
  });

  it('handles null and primitives', () => {
    expect(hashInput(null)).toMatch(/^sha256:/);
    expect(hashInput(42)).toMatch(/^sha256:/);
    expect(hashInput('x')).toMatch(/^sha256:/);
  });
});
