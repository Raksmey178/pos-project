import { hash, verify } from "@node-rs/argon2";

// PINs are hashed with Argon2id plus a secret key (PIN_SECRET) that lives only in
// the server's environment. A 4-digit PIN has just 10,000 possibilities, so without
// the secret a stolen database could be cracked in seconds. With it, it cannot.

const MIN_SECRET_LENGTH = 32;

function getSecret(): Uint8Array {
  const secret = process.env.PIN_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("PIN_SECRET must be set and at least 32 characters long");
  }
  return Buffer.from(secret);
}

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, { secret: getSecret() });
}

export async function verifyPin(storedHash: string, pin: string): Promise<boolean> {
  const secret = getSecret(); // a missing secret is a setup error, not "wrong PIN"
  try {
    return await verify(storedHash, pin, { secret });
  } catch {
    return false; // malformed hash
  }
}

let dummyHash: Promise<string> | undefined;

/** Spends the same time as a real check, so "unknown user" and "wrong PIN" look alike. */
export async function verifyDummyPin(pin: string): Promise<void> {
  dummyHash ??= hashPin("not-a-real-pin");
  await verifyPin(await dummyHash, pin);
}
