const uploadLimitBytes =
  5 * 1024 * 1024

const targetBytes =
  4.5 * 1024 * 1024

const maxDimension = 1920

function fileExtension(name: string) {
  const index = name.lastIndexOf('.')

  return index >= 0
    ? name.slice(index)
    : ''
}

function withoutExtension(name: string) {
  const extension = fileExtension(name)

  return extension
    ? name.slice(0, -extension.length)
    : name
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>(
    (resolve, reject) => {
      const image = new Image()
      const url = URL.createObjectURL(file)

      image.onload = () => {
        URL.revokeObjectURL(url)
        resolve(image)
      }

      image.onerror = () => {
        URL.revokeObjectURL(url)
        reject(
          new Error(
            'Não foi possível processar esta imagem.',
          ),
        )
      }

      image.src = url
    },
  )
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(
          new Error(
            'Não foi possível compactar a imagem.',
          ),
        )
      },
      'image/jpeg',
      quality,
    )
  })
}

function dimensionsFor(
  width: number,
  height: number,
  limit: number,
) {
  const scale = Math.min(
    1,
    limit / Math.max(width, height),
  )

  return {
    width: Math.max(
      1,
      Math.round(width * scale),
    ),
    height: Math.max(
      1,
      Math.round(height * scale),
    ),
  }
}

async function renderJpeg(
  image: HTMLImageElement,
  limit: number,
  quality: number,
) {
  const dimensions = dimensionsFor(
    image.naturalWidth,
    image.naturalHeight,
    limit,
  )

  const canvas =
    document.createElement('canvas')

  canvas.width = dimensions.width
  canvas.height = dimensions.height

  const context =
    canvas.getContext('2d')

  if (!context) {
    throw new Error(
      'Canvas indisponível para compactação.',
    )
  }

  context.fillStyle = '#ffffff'
  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height,
  )
  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return canvasToBlob(
    canvas,
    quality,
  )
}

export async function prepareEvidenceFile(
  file: File,
) {
  if (file.size <= 0) {
    throw new Error('Arquivo vazio.')
  }

  if (
    !file.type.startsWith('image/')
  ) {
    if (file.size > uploadLimitBytes) {
      throw new Error(
        'Documento acima de 5 MB.',
      )
    }

    return file
  }

  const browserCompressible =
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/webp'

  if (!browserCompressible) {
    if (file.size > uploadLimitBytes) {
      throw new Error(
        'Esta imagem não pode ser compactada pelo navegador e ultrapassa 5 MB.',
      )
    }

    return file
  }

  const image = await loadImage(file)

  const alreadyOptimized =
    file.size <= 2 * 1024 * 1024 &&
    Math.max(
      image.naturalWidth,
      image.naturalHeight,
    ) <= maxDimension

  if (alreadyOptimized) {
    return file
  }

  const attempts = [
    {
      limit: 1920,
      quality: 0.82,
    },
    {
      limit: 1600,
      quality: 0.74,
    },
    {
      limit: 1280,
      quality: 0.66,
    },
  ]

  let best: Blob | null = null

  for (const attempt of attempts) {
    const blob = await renderJpeg(
      image,
      attempt.limit,
      attempt.quality,
    )

    best = blob

    if (blob.size <= targetBytes) {
      break
    }
  }

  if (
    !best ||
    best.size > uploadLimitBytes
  ) {
    throw new Error(
      'Não foi possível reduzir a imagem para menos de 5 MB.',
    )
  }

  const name =
    `${withoutExtension(file.name)}.jpg`

  return new File(
    [best],
    name,
    {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    },
  )
}
