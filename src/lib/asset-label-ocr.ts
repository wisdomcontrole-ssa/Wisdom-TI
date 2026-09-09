import {
  createWorker,
  OEM,
  PSM,
} from 'tesseract.js'
import type {
  AssetLabelAnalysis,
  LabelSuggestion,
  SuggestionConfidence,
} from '../types/asset-smart'

interface OcrItem {
  text: string
  score: number
}

interface OcrMetrics {
  totalMs?: number
  detectedBoxes?: number
  recognizedCount?: number
}

interface TesseractProgressMessage {
  progress?: number
  status?: string
}

type OcrProgressCallback = (
  progress: number,
  status: string,
) => void

type TesseractWorker = Awaited<
  ReturnType<typeof createWorker>
>

const TESSERACT_BASE = '/ocr/tesseract'
const TESSERACT_WORKER =
  `${TESSERACT_BASE}/worker.min.js`
const TESSERACT_CORE =
  `${TESSERACT_BASE}/core`
const TESSERACT_LANG =
  `${TESSERACT_BASE}/lang`

let workerPromise:
  | Promise<TesseractWorker>
  | null = null
let progressCallback:
  | OcrProgressCallback
  | null = null

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

  const boundedScore = Math.max(
    0,
    Math.min(1, score),
  )
  const confidence =
    confidenceFromScore(boundedScore)

  return {
    value: clean,
    score: boundedScore,
    confidence,
    source,
    requiresReview:
      confidence !== 'high',
  }
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
    .replace(/^[=:;#-]+\s*/, '')
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
    const line = normalized(items[index].text)

    for (const label of labels) {
      const match = line.match(label)
      if (!match) continue

      const inlineValue = cleanValue(
        match[1] ?? '',
      )

      if (inlineValue.length >= 2) {
        return {
          value: inlineValue,
          score: items[index].score,
          source: line,
        }
      }

      const next = items[index + 1]

      if (next) {
        const nextValue = cleanValue(
          next.text,
        )

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
    'Hewlett Packard',
    'Acer',
    'ASUS',
    'ASUSTeK',
    'Positivo',
    'Epson',
    'Brother',
    'LG',
    'Intelbras',
    'Multilaser',
    'Apple',
    'Microsoft',
    'AOC',
    'TP-Link',
  ]

  for (const item of items) {
    const line = normalized(item.text)

    const brand = brands.find(
      (candidate) =>
        new RegExp(
          `\\b${candidate
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/[ -]/g, '[ -]')}\\b`,
          'i',
        ).test(line),
    )

    if (brand) {
      const canonical =
        /^hewlett[ -]packard$/i.test(
          brand,
        )
          ? 'HP'
          : /^asustek$/i.test(brand)
            ? 'ASUS'
            : brand

      return suggestion(
        canonical,
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
    .map((item) => normalized(item.text))
    .join(' · ')

  const voltage = joined.match(
    /\b(?:INPUT|ENTRADA|ALIMENTA[CÇ][AÃ]O)?\s*:?\s*((?:\d{2,3}\s*[-–]\s*\d{2,3}|\d{2,3})\s*V(?:AC|DC)?)/i,
  )?.[1]

  const frequency = joined.match(
    /\b(\d{2,3}\s*(?:[-–]\s*\d{2,3}\s*)?HZ)\b/i,
  )?.[1]

  const current = joined.match(
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
  rawText: string,
  metrics?: OcrMetrics,
): AssetLabelAnalysis {
  const cleaned = items
    .map((item) => ({
      text: normalized(item.text),
      score: Number.isFinite(item.score)
        ? item.score
        : 0,
    }))
    .filter((item) => item.text)

  const serviceTag = findLabeled(
    cleaned,
    [
      /SERVICE\s*TAG(?:\s*\(S\/N\))?\s*[:#-]?\s*(.*)$/i,
      /SERVICE\s*CODE\s*[:#-]?\s*(.*)$/i,
      /EXPRESS\s*SERVICE\s*CODE\s*[:#-]?\s*(.*)$/i,
    ],
  )

  const serial = findLabeled(
    cleaned,
    [
      /SERIAL\s*(?:NUMBER|NO\.?|#)?\s*[:#-]?\s*(.*)$/i,
      /SER\.?(?:IAL)?\s*NO\.?\s*[:#-]?\s*(.*)$/i,
      /\bS\/N(?:\s*\(1S\))?\s*[:#-]?\s*(.*)$/i,
      /\bSN\s*[:#-]\s*(.*)$/i,
    ],
  )

  const model = findLabeled(
    cleaned,
    [
      /MODEL\s*(?:ID\.?|NO\.?|NUMBER|NAME|CODE)?\s*[:#-]?\s*(.*)$/i,
      /PRODUCT\s*NAME\s*[:#-]?\s*(.*)$/i,
      /MACHINE\s*TYPE(?:\s*MODEL)?\s*[:#-]?\s*(.*)$/i,
      /TYPE\s*MODEL\s*[:#-]?\s*(.*)$/i,
    ],
  )

  const productNumber = findLabeled(
    cleaned,
    [
      /PRODUCT\s*(?:NO\.?|NUMBER|P\/N)\s*[:#-]?\s*(.*)$/i,
      /\bP\/N\s*[:#-]?\s*(.*)$/i,
      /\bPN\s*[:#-]\s*(.*)$/i,
      /\bPART\s*(?:NO\.?|NUMBER)\s*[:#-]?\s*(.*)$/i,
      /\bFRU\s*P\/N\s*[:#-]?\s*(.*)$/i,
      /\bMTM\s*[:#-]?\s*(.*)$/i,
    ],
  )

  let serviceSuggestion = serviceTag
    ? suggestion(
        serviceTag.value,
        serviceTag.score,
        serviceTag.source,
      )
    : undefined

  let serialSuggestion = serial
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
    const dellCandidate = barcodes.find(
      (value) =>
        /^[A-Z0-9]{7}$/i.test(value),
    )

    if (dellCandidate) {
      serviceSuggestion = suggestion(
        dellCandidate,
        0.62,
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
        0.56,
        'Código de barras sem rótulo confirmado',
      )
    }
  }

  return {
    engine:
      'tesseract' as AssetLabelAnalysis['engine'],
    engineVersion: 'Tesseract.js 7.0.0',
    rawText:
      rawText.trim() ||
      cleaned
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
      serialNumber: serialSuggestion,
      serviceTag: serviceSuggestion,
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

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker(
        'eng',
        OEM.LSTM_ONLY,
        {
          workerPath: TESSERACT_WORKER,
          corePath: TESSERACT_CORE,
          langPath: TESSERACT_LANG,
          workerBlobURL: false,
          gzip: true,
          logger: (
            message: TesseractProgressMessage,
          ) => {
            progressCallback?.(
              Math.max(
                0,
                Math.min(
                  1,
                  message.progress ?? 0,
                ),
              ),
              message.status ?? 'OCR',
            )
          },
        },
      )

      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      })

      return worker
    })().catch((error) => {
      workerPromise = null
      throw error
    })
  }

  return workerPromise
}

function linesFromResult(
  text: string,
  confidence: number,
  blocks:
    | Array<{
        paragraphs: Array<{
          lines: Array<{
            text: string
            confidence: number
          }>
        }>
      }>
    | null
    | undefined,
) {
  const blockLines =
    blocks
      ?.flatMap((block) =>
        block.paragraphs.flatMap(
          (paragraph) =>
            paragraph.lines.map(
              (line) => ({
                text: line.text,
                score:
                  Math.max(
                    0,
                    Math.min(
                      100,
                      line.confidence ??
                        confidence,
                    ),
                  ) / 100,
              }),
            ),
        ),
      )
      .filter((item) =>
        normalized(item.text),
      ) ?? []

  if (blockLines.length > 0) {
    return blockLines
  }

  const fallbackScore =
    Math.max(
      0,
      Math.min(100, confidence),
    ) / 100

  return text
    .split(/\r?\n/)
    .map((line) => ({
      text: line,
      score: fallbackScore,
    }))
    .filter((item) =>
      normalized(item.text),
    )
}

export async function analyzeAssetLabel(
  file: File,
  barcodes: string[] = [],
  onProgress?: OcrProgressCallback,
) {
  const startedAt = performance.now()
  progressCallback = onProgress ?? null

  try {
    const worker = await getWorker()

    progressCallback?.(
      0.05,
      'Preparando leitura OCR',
    )

    const result = await worker.recognize(
      file,
      {
        rotateAuto: true,
      },
      {
        text: true,
        blocks: true,
      },
    )

    const rawText = result.data.text ?? ''
    const items = linesFromResult(
      rawText,
      result.data.confidence ?? 0,
      result.data.blocks,
    )

    if (
      items.length === 0 &&
      barcodes.length === 0
    ) {
      throw new Error(
        'Nenhum texto legível foi encontrado na etiqueta. Aproxime a câmera, evite reflexos e fotografe novamente.',
      )
    }

    progressCallback?.(1, 'Leitura concluída')

    return parseResult(
      items,
      barcodes,
      rawText,
      {
        totalMs: Math.round(
          performance.now() - startedAt,
        ),
        detectedBoxes: items.length,
        recognizedCount: items.length,
      },
    )
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : String(error)

    throw new Error(
      `Falha no OCR local Tesseract: ${detail}`,
      { cause: error },
    )
  } finally {
    progressCallback = null
  }
}
