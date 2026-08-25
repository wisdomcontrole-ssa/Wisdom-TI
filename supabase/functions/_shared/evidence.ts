/* eslint-disable */

export const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])

export const maxEvidenceBytes =
  20 * 1024 * 1024

export const captureMethods = new Set([
  'camera',
  'gallery',
  'file',
  'system',
])

function extensionFromMime(mimeType: string) {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
  }

  return map[mimeType] ?? 'bin'
}

function safeToken(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export function buildStoredName(
  referenceCode: string,
  categoryCode: string,
  mimeType: string,
) {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')

  const shortId =
    crypto.randomUUID().split('-')[0]

  return [
    now,
    safeToken(categoryCode),
    safeToken(referenceCode),
    shortId,
  ].join('_') +
    `.${extensionFromMime(mimeType)}`
}

export async function sha256Hex(
  bytes: Uint8Array,
) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes,
  )

  return Array.from(
    new Uint8Array(digest),
  )
    .map((byte) =>
      byte.toString(16).padStart(2, '0'),
    )
    .join('')
}
