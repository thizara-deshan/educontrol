// RFC 4122 v4 from getRandomValues: the built-in UUID helper is secure-context only, and the room UI
// is plain http://r-101.local (SPEC §2.1). Review M02 F1.
export function uuidV4(fill: (bytes: Uint8Array<ArrayBuffer>) => void = (bytes) => crypto.getRandomValues(bytes)): string {
  const bytes = new Uint8Array(16);
  fill(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
