import type { EquipmentCategory } from './types';
import { normalizeForMatch } from './normalize';

export interface ManufacturerEntry {
  name: string;
  aliases: readonly string[];
  categories?: readonly EquipmentCategory[];
}

export const MANUFACTURERS: readonly ManufacturerEntry[] = [
  { name: 'Login', aliases: ['LOGIN', 'LOGIN INFORMATICA', 'LOGIN INFORMÃTICA'] },
  { name: 'Dell', aliases: ['DELL', 'DELL INC', 'DELL INC.'] },
  { name: 'HP', aliases: ['HP', 'HP INC', 'HEWLETT PACKARD', 'HEWLETT-PACKARD'] },
  { name: 'Lenovo', aliases: ['LENOVO', 'LENOVO GROUP'] },
  { name: 'Acer', aliases: ['ACER'] },
  { name: 'ASUS', aliases: ['ASUS', 'ASUSTEK', 'ASUSTEK COMPUTER'] },
  { name: 'MSI', aliases: ['MSI', 'MICRO-STAR', 'MICRO STAR INTERNATIONAL'] },
  { name: 'Gigabyte', aliases: ['GIGABYTE', 'GIGABYTE TECHNOLOGY'] },
  { name: 'ASRock', aliases: ['ASROCK'] },
  { name: 'Positivo', aliases: ['POSITIVO', 'POSITIVO TECNOLOGIA'] },
  { name: 'Daten', aliases: ['DATEN'] },
  { name: 'Intel', aliases: ['INTEL', 'INTEL CORPORATION'] },
  { name: 'AMD', aliases: ['AMD', 'ADVANCED MICRO DEVICES'] },
  { name: 'Apple', aliases: ['APPLE', 'APPLE INC'] },
  { name: 'Samsung', aliases: ['SAMSUNG'] },
  { name: 'LG', aliases: ['LG', 'LG ELECTRONICS'] },
  { name: 'AOC', aliases: ['AOC'] },
  { name: 'Philips', aliases: ['PHILIPS'] },
  { name: 'Epson', aliases: ['EPSON', 'SEIKO EPSON'] },
  { name: 'Brother', aliases: ['BROTHER'] },
  { name: 'Canon', aliases: ['CANON'] },
  { name: 'Zebra', aliases: ['ZEBRA', 'ZEBRA TECHNOLOGIES'] },
  { name: 'Lexmark', aliases: ['LEXMARK'] },
  { name: 'Xerox', aliases: ['XEROX'] },
  { name: 'Ricoh', aliases: ['RICOH'] },
  { name: 'Kyocera', aliases: ['KYOCERA'] },
  { name: 'Cisco', aliases: ['CISCO', 'CISCO SYSTEMS'] },
  { name: 'Aruba', aliases: ['ARUBA', 'ARUBA NETWORKS'] },
  { name: 'Ubiquiti', aliases: ['UBIQUITI', 'UBNT'] },
  { name: 'MikroTik', aliases: ['MIKROTIK', 'MIKROTIKLS'] },
  { name: 'TP-Link', aliases: ['TP-LINK', 'TPLINK'] },
  { name: 'D-Link', aliases: ['D-LINK', 'DLINK'] },
  { name: 'Intelbras', aliases: ['INTELBRAS'] },
  { name: 'Fortinet', aliases: ['FORTINET', 'FORTIGATE'] },
  { name: 'Huawei', aliases: ['HUAWEI'] },
  { name: 'Juniper', aliases: ['JUNIPER', 'JUNIPER NETWORKS'] },
  { name: 'Netgear', aliases: ['NETGEAR'] },
  { name: 'Realtek', aliases: ['REALTEK', 'REALTEK SEMICONDUCTOR'] },
  { name: 'Qualcomm', aliases: ['QUALCOMM', 'QUALCOMM ATHEROS', 'ATHEROS'] },
  { name: 'Broadcom', aliases: ['BROADCOM'] },
  { name: 'Kingston', aliases: ['KINGSTON', 'KINGSTON TECHNOLOGY'] },
  { name: 'Crucial', aliases: ['CRUCIAL', 'MICRON CRUCIAL'] },
  { name: 'Micron', aliases: ['MICRON', 'MICRON TECHNOLOGY'] },
  { name: 'Western Digital', aliases: ['WESTERN DIGITAL', 'WDC', 'WD'] },
  { name: 'Seagate', aliases: ['SEAGATE'] },
  { name: 'SanDisk', aliases: ['SANDISK'] },
  { name: 'APC', aliases: ['APC', 'APC BY SCHNEIDER ELECTRIC'] },
  { name: 'SMS', aliases: ['SMS'] },
  { name: 'TS Shara', aliases: ['TS SHARA', 'TSSHARA'] },
  { name: 'Ragtech', aliases: ['RAGTECH'] },
  { name: 'Multilaser', aliases: ['MULTILASER', 'MULTI'] },
  { name: 'Logitech', aliases: ['LOGITECH'] },
  { name: 'Microsoft', aliases: ['MICROSOFT', 'MS'] },
  { name: 'Synology', aliases: ['SYNOLOGY'] },
  { name: 'QNAP', aliases: ['QNAP'] },
];

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - levenshtein(a, b) / maxLength;
}

export interface ManufacturerMatch {
  name: string;
  alias: string;
  confidence: number;
  fuzzy: boolean;
}

export function matchManufacturer(
  text: string,
  allowFuzzy = true,
): ManufacturerMatch | null {
  const normalized = normalizeForMatch(text);

  const exactCandidates = MANUFACTURERS.flatMap((manufacturer) =>
    manufacturer.aliases.map((alias) => ({
      manufacturer,
      alias,
      normalizedAlias: normalizeForMatch(alias),
    })),
  ).sort((a, b) => b.normalizedAlias.length - a.normalizedAlias.length);

  for (const candidate of exactCandidates) {
    const escaped = candidate.normalizedAlias.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
    const rx = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`);

    if (rx.test(normalized)) {
      return {
        name: candidate.manufacturer.name,
        alias: candidate.alias,
        confidence: 0.99,
        fuzzy: false,
      };
    }
  }

  if (!allowFuzzy) return null;

  const tokens = normalized
    .split(' ')
    .filter((token) => token.length >= 3);

  let best: ManufacturerMatch | null = null;

  for (const candidate of exactCandidates) {
    if (candidate.normalizedAlias.length < 4) continue;

    for (const token of tokens) {
      const score = similarity(token, candidate.normalizedAlias);

      if (score >= 0.82 && (!best || score > best.confidence)) {
        best = {
          name: candidate.manufacturer.name,
          alias: candidate.alias,
          confidence: Math.min(0.94, score),
          fuzzy: true,
        };
      }
    }
  }

  return best;
}
