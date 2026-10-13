import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// ARCHITECTURE §5 / D-08: `scrypt$N$r$p$salt$hash` (base64), node:crypto only.

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function derive(pin: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pin, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Constant-time compare; a malformed stored hash never matches. */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || n === undefined || r === undefined || p === undefined || salt === undefined || hash === undefined) {
    return false;
  }
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(pin, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
