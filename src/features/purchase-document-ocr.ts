import {
  analyzeAssetLabel,
} from '../lib/asset-label-ocr'

export interface PurchaseDocumentPrefill {
  number?: string
  series?: string
  accessKey?: string
  issuerName?: string
  issuerTaxId?: string
  issueDate?: string
  rawText: string
}

function normalizeLine(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
}

function digits(value: string) {
  return value.replace(/\D/g, '')
}

function toIsoDate(
  day: string,
  month: string,
  year: string,
) {
  const y =
    year.length === 2
      ? Number(year) >= 70
        ? `19${year}`
        : `20${year}`
      : year

  return `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function extractAccessKey(text: string) {
  const candidates =
    text.match(/(?:\d[\s.\-]?){44}/g) ?? []

  return candidates
    .map(digits)
    .find((value) => value.length === 44)
}

function extractTaxId(text: string) {
  const cnpj = text.match(
    /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}\b/,
  )?.[0]

  if (cnpj) return digits(cnpj)

  const cpf = text.match(
    /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/,
  )?.[0]

  return cpf ? digits(cpf) : undefined
}

function extractIssueDate(text: string) {
  const match = text.match(
    /(?:EMISS[AÃ]O|DATA\s+DE\s+EMISS[AÃ]O|EMITIDA\s+EM)\s*[:\-]?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i,
  ) ?? text.match(
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/,
  )

  if (!match) return undefined

  return toIsoDate(
    match[1],
    match[2],
    match[3],
  )
}

function extractNumber(text: string) {
  const patterns = [
    /(?:N[ÚU]MERO\s+DA\s+NOTA|N[ÚU]MERO\s+NF[- ]?E|NOTA\s+FISCAL\s+(?:N[º°O.]?|N[ÚU]MERO)|NF[- ]?E\s+(?:N[º°O.]?|N[ÚU]MERO)|N[º°O.]\s*)[:#\-]?\s*(\d{1,12})/i,
    /\bNF[- ]?E\s*[:#\-]?\s*(\d{3,12})\b/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1]
  }

  return undefined
}

function extractSeries(text: string) {
  return text.match(
    /\bS[EÉ]RIE\s*[:#\-]?\s*([A-Z0-9]{1,6})\b/i,
  )?.[1]
}

function extractIssuer(lines: string[]) {
  const labeled = [
    /^(?:RAZ[AÃ]O\s+SOCIAL|EMITENTE|FORNECEDOR|NOME\s+EMPRESARIAL)\s*[:\-]?\s*(.+)$/i,
  ]

  for (const line of lines) {
    for (const pattern of labeled) {
      const match = line.match(pattern)
      const value = match?.[1]?.trim()
      if (value && value.length >= 3) {
        return value
      }
    }
  }

  const cnpjIndex = lines.findIndex((line) =>
    /CNPJ/i.test(line),
  )

  if (cnpjIndex > 0) {
    for (
      let index = cnpjIndex - 1;
      index >= Math.max(0, cnpjIndex - 3);
      index -= 1
    ) {
      const candidate = lines[index]

      if (
        candidate.length >= 3 &&
        candidate.length <= 100 &&
        !/DANFE|DOCUMENTO\s+AUXILIAR|NOTA\s+FISCAL|CNPJ|IE\b/i.test(
          candidate,
        )
      ) {
        return candidate
      }
    }
  }

  return undefined
}

export function parsePurchaseDocumentText(
  rawText: string,
): PurchaseDocumentPrefill {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)

  const text = lines.join('\n')

  return {
    number: extractNumber(text),
    series: extractSeries(text),
    accessKey: extractAccessKey(text),
    issuerName: extractIssuer(lines),
    issuerTaxId: extractTaxId(text),
    issueDate: extractIssueDate(text),
    rawText,
  }
}

export async function analyzePurchaseDocument(
  file: File,
  onProgress?: (
    progress: number,
    status: string,
  ) => void,
) {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      'A leitura automática usa foto/imagem. PDF pode continuar anexado, mas o preenchimento automático requer uma foto.',
    )
  }

  const analysis = await analyzeAssetLabel(
    file,
    [],
    onProgress,
  )

  return parsePurchaseDocumentText(
    analysis.rawText,
  )
}
