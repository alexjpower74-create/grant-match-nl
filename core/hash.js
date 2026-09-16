// SHA-256 as lowercase hex — docs/API.md §10. Uses crypto.subtle (Node and workerd).

/** sha256Hex(stringOrBytes) → Promise<string>. Strings are hashed as UTF-8. */
export async function sha256Hex(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
