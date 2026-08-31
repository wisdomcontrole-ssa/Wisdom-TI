import type {
  AssetLabelAnalysis,
  LabelSuggestion,
  SuggestionConfidence,
} from '../types/asset-smart'

interface OcrItem {
  text: string
  score: number
}

interface OcrResult {
  items: OcrItem[]
  metrics?: {
    totalMs?: number
    detectedBoxes?: number
    recognizedCount?: number
  }
}

interface PaddleInstance {
  predict(
    input: Blob | HTMLCanvasElement,
    params?: Record<string, unknown>,
  ): Promise<OcrResult[]>
}

let instancePromise: Promise<PaddleInstance> | null =
  null

function confidenceFromScore(
  score: number,
): SuggestionConfidence {
  if (score >= 0.82) return 'high'
  if (score >= 0.62) return 'medium'
  return 'low'
}

function suggestion(
  value: string,
  score: number,
  source: string,
): LabelSuggestion | undefined {
  const clean = value
    .replace(/^[\s:;#-]+/, '')
    .replace(/[\s:;]+$/, '')
    .trim()

  if (!clean) return undefined

  const confidence =
    confidenceFromScore(score)

  return {
    value: clean,
    score,
    confidence,
    source,
    requiresReview:
      confidence !== 'high',
  }
}

async function getOcr() {
  if (!instancePromise) {
    instancePromise = (async () => {
      const module =
        await import(
          '@paddleocr/paddleocr-js'
        )

      const created =
        await module.PaddleOCR.create({
          lang: 'pt',
          ocrVersion: 'PP-OCRv5',
          worker: true,
          textRecognitionBatchSize: 6,
          ortOptions: {
            backend: 'wasm',
            wasmPaths:
              'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/',
            numThreads: 1,
            simd: true,
          },
        })

      return created as unknown as PaddleInstance
    })().catch((error) => {
      instancePromise = null
      throw error
    })
  }

  return instancePromise
}

function normalized(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[|]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanValue(value: string) {
  return normalized(value)
    .replace(
      /^(?:NO\.?|Nº|NUMBER|NUMERO|NÚMERO)\s*/i,
      '',
    )
    .trim()
}

function findLabeled(
  items: OcrItem[],
  labels: RegExp[],
) {
  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const line =
      normalized(items[index].text)

    for (const label of labels) {
      const match = line.match(label)
      if (!match) continue

      const inlineValue =
        cleanValue(match[1] ?? '')

      if (inlineValue.length >= 2) {
        return {
          value: inlineValue,
          score: items[index].score,
          source: line,
        }
      }

      const next = items[index + 1]

      if (next) {
        const nextValue =
          cleanValue(next.text)

        if (nextValue.length >= 2) {
          return {
            value: nextValue,
            score: Math.min(
              items[index].score,
              next.score,
            ),
            source:
              `${line} → ${normalized(next.text)}`,
          }
        }
      }
    }
  }

  return null
}

function manufacturerSuggestion(
  items: OcrItem[],
) {
  const brands = [
    'Dell',
    'Lenovo',
    'Philips',
    'Samsung',
    'HP',
    'Hewlett-Packard',
    'Acer',
    'ASUS',
    'Positivo',
    'Epson',
    'Brother',
    'LG',
    'Intelbras',
    'Multilaser',
  ]

  for (const item of items) {
    const line =
      normalized(item.text)

    const brand = brands.find(
      (candidate) =>
        new RegExp(
          `\\b${candidate.replace(
            '-',
            '[- ]',
          )}\\b`,
          'i',
        ).test(line),
    )

    if (brand) {
      return suggestion(
        brand === 'Hewlett-Packard'
          ? 'HP'
          : brand,
        Math.max(item.score, 0.9),
        line,
      )
    }
  }

  return undefined
}

function electricalSuggestion(
  items: OcrItem[],
) {
  const joined = items
    .map((item) =>
      normalized(item.text),
    )
    .join(' · ')

  const voltage =
    joined.match(
      /\b(?:INPUT|ENTRADA|ALIMENTA[CÇ][AÃ]O)?\s*:?\s*((?:\d{2,3}\s*[-–]\s*\d{2,3}|\d{2,3})\s*V(?:AC|DC)?)/i,
    )?.[1]

  const frequency =
    joined.match(
      /\b(\d{2,3}\s*(?:[-–]\s*\d{2,3}\s*)?HZ)\b/i,
    )?.[1]

  const current =
    joined.match(
      /\b(\d+(?:[.,]\d+)?\s*A)\b/i,
    )?.[1]

  const pieces = [
    voltage,
    frequency,
    current,
  ].filter(Boolean)

  if (pieces.length === 0) {
    return undefined
  }

  return suggestion(
    pieces.join(' · '),
    0.78,
    'Dados elétricos detectados',
  )
}

function parseResult(
  items: OcrItem[],
  barcodes: string[],
  metrics?: OcrResult['metrics'],
): AssetLabelAnalysis {
  const cleaned = items
    .map((item) => ({
      text: normalized(item.text),
      score:
        Number.isFinite(item.score)
          ? item.score
          : 0,
    }))
    .filter((item) => item.text)

  const serviceTag = findLabeled(
    cleaned,
    [
      /SERVICE\s*TAG(?:\(S\/N\))?\s*[:#-]?\s*(.*)$/i,
      /SERVICE\s*CODE\s*[:#-]?\s*(.*)$/i,
    ],
  )

  const serial = findLabeled(
    cleaned,
    [
      /SERIAL\s*(?:NUMBER|NO\.?|#)?\s*[:#-]?\s*(.*)$/i,
      /\bS\/N(?:\s*\(1S\))?\s*[:#-]?\s*(.*)$/i,
      /\bSN\s*[:#-]\s*(.*)$/i,
    ],
  )

  const model = findLabeled(
    cleaned,
    [
      /MODEL\s*(?:ID\.?|NO\.?|NUMBER|CODE)?\s*[:#-]?\s*(.*)$/i,
      /PRODUCT\s*NAME\s*[:#-]?\s*(.*)$/i,
      /MACHINE\s*TYPE(?:\s*MODEL)?\s*[:#-]?\s*(.*)$/i,
    ],
  )

  const productNumber = findLabeled(
    cleaned,
    [
      /PRODUCT\s*(?:NO\.?|NUMBER|P\/N)\s*[:#-]?\s*(.*)$/i,
      /\bP\/N\s*[:#-]?\s*(.*)$/i,
      /\bPART\s*(?:NO\.?|NUMBER)\s*[:#-]?\s*(.*)$/i,
      /\bFRU\s*P\/N\s*[:#-]?\s*(.*)$/i,
      /\bMTM\s*[:#-]?\s*(.*)$/i,
    ],
  )

  let serviceSuggestion =
    serviceTag
      ? suggestion(
          serviceTag.value,
          serviceTag.score,
          serviceTag.source,
        )
      : undefined

  let serialSuggestion =
    serial
      ? suggestion(
          serial.value,
          serial.score,
          serial.source,
        )
      : undefined

  if (
    !serviceSuggestion &&
    barcodes.length > 0 &&
    cleaned.some((item) =>
      /\bDELL\b/i.test(item.text),
    )
  ) {
    const dellCandidate =
      barcodes.find((value) =>
        /^[A-Z0-9]{7}$/i.test(value),
      )

    if (dellCandidate) {
      serviceSuggestion = suggestion(
        dellCandidate,
        0.58,
        'Código de barras em etiqueta Dell',
      )
    }
  }

  if (
    !serialSuggestion &&
    barcodes.length === 1
  ) {
    const candidate = barcodes[0]

    if (
      /^[A-Z0-9][A-Z0-9._/-]{5,24}$/i.test(
        candidate,
      )
    ) {
      serialSuggestion = suggestion(
        candidate,
        0.52,
        'Código de barras sem rótulo confirmado',
      )
    }
  }

  return {
    engine: 'paddleocr',
    engineVersion: 'PP-OCRv5',
    rawText: cleaned
      .map((item) => item.text)
      .join('\n'),
    barcodes,
    fields: {
      manufacturer:
        manufacturerSuggestion(cleaned),
      model: model
        ? suggestion(
            model.value,
            model.score,
            model.source,
          )
        : undefined,
      serialNumber:
        serialSuggestion,
      serviceTag:
        serviceSuggestion,
      productNumber: productNumber
        ? suggestion(
            productNumber.value,
            productNumber.score,
            productNumber.source,
          )
        : undefined,
      electricalRating:
        electricalSuggestion(cleaned),
    },
    metrics: {
      totalMs: metrics?.totalMs,
      detectedBoxes:
        metrics?.detectedBoxes,
      recognizedCount:
        metrics?.recognizedCount,
    },
  }
}

export async function analyzeAssetLabel(
  file: File,
  barcodes: string[] = [],
) {
  const ocr = await getOcr()

  const [result] = await ocr.predict(
    file,
    {
      textDetLimitSideLen: 1600,
      textDetBoxThresh: 0.45,
      textRecScoreThresh: 0.3,
    },
  )

  if (!result) {
    throw new Error(
      'O OCR não retornou resultado.',
    )
  }

  return parseResult(
    result.items ?? [],
    barcodes,
    result.metrics,
  )
}
