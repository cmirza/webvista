export const CUSTOM_ICON_MAX_BYTES = 2 * 1024 * 1024

export const CUSTOM_ICON_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

type CustomIconType = keyof typeof CUSTOM_ICON_TYPES

export class IconUploadError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage)
    this.name = 'IconUploadError'
  }
}

const bytesStartWith = (bytes: Uint8Array, expected: number[]): boolean =>
  expected.every((value, index) => bytes[index] === value)

const matchesSignature = (type: CustomIconType, bytes: Uint8Array): boolean => {
  if (type === 'image/png') {
    return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  }

  if (type === 'image/jpeg') {
    return bytesStartWith(bytes, [0xff, 0xd8, 0xff])
  }

  return (
    bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytesStartWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  )
}

export const validateCustomIcon = async (file: File): Promise<CustomIconType> => {
  if (file.size === 0) {
    throw new IconUploadError('Choose a PNG, JPEG, or WebP image.')
  }

  if (file.size > CUSTOM_ICON_MAX_BYTES) {
    throw new IconUploadError('Custom icons must be 2 MB or smaller.')
  }

  if (!(file.type in CUSTOM_ICON_TYPES)) {
    throw new IconUploadError('Choose a PNG, JPEG, or WebP image.')
  }

  const type = file.type as CustomIconType
  const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer())

  if (!matchesSignature(type, signature)) {
    throw new IconUploadError(
      'The selected file does not appear to be a valid PNG, JPEG, or WebP image.',
    )
  }

  return type
}

export const storeCustomIcon = async (
  bucket: R2Bucket,
  file: File,
): Promise<string> => {
  const type = await validateCustomIcon(file)
  const extension = CUSTOM_ICON_TYPES[type]
  const key = `favorite-icons/${crypto.randomUUID()}.${extension}`

  await bucket.put(key, file, {
    httpMetadata: {
      cacheControl: 'public, max-age=31536000, immutable',
      contentDisposition: 'inline',
      contentType: type,
    },
    customMetadata: { purpose: 'favorite-icon' },
  })

  return key
}

export const deleteCustomIcon = async (
  bucket: R2Bucket,
  key: string | null | undefined,
): Promise<void> => {
  if (key && customIconFileName(key)) {
    await bucket.delete(key)
  }
}

export const customIconFileName = (key: string): string | null => {
  const match = /^favorite-icons\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp))$/.exec(key)
  return match?.[1] ?? null
}

export const customIconKey = (fileName: string): string | null =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/.test(fileName)
    ? `favorite-icons/${fileName}`
    : null

export const customIconPath = (key: string | null): string | null => {
  if (!key) {
    return null
  }

  const fileName = customIconFileName(key)
  return fileName ? `/icons/${fileName}` : null
}
