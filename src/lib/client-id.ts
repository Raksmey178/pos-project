/**
 * A random v4 UUID made in the browser. Every order and every added item gets one BEFORE it is sent,
 * so if the network drops and the request is sent again, the server knows it is the same request
 * and never creates a duplicate.
 * (crypto.randomUUID() only exists on HTTPS pages; on a restaurant's http:// network it is missing,
 * so this builds the UUID from crypto.getRandomValues, which works everywhere.)
 */
export function newClientId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
