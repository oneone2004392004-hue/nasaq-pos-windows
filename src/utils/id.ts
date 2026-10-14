/**
 * Utility for cryptographically secure ID generation.
 * Strictly adheres to project architectural guidelines:
 * NEVER use Math.random(), timestamps alone, or predictable values as database IDs.
 */

/**
 * Generates a collision-safe, cryptographically secure UUID v4.
 * If a prefix is provided (e.g. 'ctx', 'shift', 'exp'), it returns `${prefix}-${uuid}`.
 *
 * @param prefix Optional domain entity prefix (e.g. 'ctx', 'shift', 'exp')
 * @returns Cryptographically secure UUID string
 */
export function generateId(prefix?: string): string {
  let uuid: string;

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    uuid = crypto.randomUUID();
  } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC 4122 variant 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant 1
    uuid = [...bytes]
      .map((b, i) => ([4, 6, 8, 10].includes(i) ? `-${b.toString(16).padStart(2, '0')}` : b.toString(16).padStart(2, '0')))
      .join('');
  } else {
    throw new Error('Cryptographically secure random number generator is not available');
  }

  return prefix ? `${prefix}-${uuid}` : uuid;
}

/**
 * Validates whether a string adheres to the secure UUID v4 format (with optional prefix).
 */
export function isValidId(id: string, prefix?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (prefix) {
    const expectedPrefix = `${prefix}-`;
    if (!id.startsWith(expectedPrefix)) return false;
    const rest = id.slice(expectedPrefix.length);
    return uuidRegex.test(rest);
  }

  return uuidRegex.test(id);
}

