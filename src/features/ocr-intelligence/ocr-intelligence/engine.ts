import { matchManufacturer } from './catalog';
import {
  escapeRegExp,
  normalizeForMatch,
  normalizeOcrText,
  splitOcrLines,
} from './normalize';
import type {
  AssetPrefill,
  EquipmentCategory,
  ExtractedField,
  OcrFieldKey,
  OcrInterpretation,
} from './types';

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function isOcrMarker(line: string): boolean {
  const normalized = normalizeForMatch(line)
    .replace(/^\/+/, '')
    .trim();

  return normalized === 'ESPECIFICACOES OCR';
}

function detectCategory(text: string): EquipmentCategory {
  const n = normalizeForMatch(text);

  const checks: Array<[EquipmentCategory, RegExp]> = [
    ['notebook', /\b(NOTEBOOK|LAPTOP|ULTRABOOK)\b/],
    ['desktop', /\b(DESKTOP|COMPUTADOR|PC|WORKSTATION)\b/],
    ['server', /\b(SERVIDOR|SERVER|POWEREDGE|PROLIANT)\b/],
    ['monitor', /\b(MONITOR|DISPLAY)\b/],
    ['printer', /\b(IMPRESSORA|PRINTER|LASERJET|ECOTANK)\b/],
    ['switch', /\b(SWITCH|SWITCHING)\b/],
    ['router', /\b(ROTEADOR|ROUTER)\b/],
    ['access_point', /\b(ACCESS POINT|AP WI-FI|WIRELESS AP)\b/],
    ['firewall', /\b(FIREWALL|FORTIGATE|SOPHOS)\b/],
    ['ups', /\b(NOBREAK|UPS)\b/],
    ['stabilizer', /\b(ESTABILIZADOR)\b/],
    ['power_strip', /\b(FILTRO DE LINHA|POWER STRIP)\b/],
    ['projector', /\b(PROJETOR|PROJECTOR)\b/],
    ['keyboard', /\b(TECLADO|KEYBOARD)\b/],
    ['mouse', /\b(MOUSE)\b/],
    ['scanner', /\b(SCANNER)\b/],
    ['barcode_scanner', /\b(LEITOR DE CODIGO|BARCODE SCANNER)\b/],
    ['webcam', /\b(WEBCAM|CAMERA USB)\b/],
    ['dock', /\b(DOCK|DOCKING STATION)\b/],
    ['nas', /\b(NAS|NETWORK ATTACHED STORAGE)\b/],
  ];

  return checks.find(([, rx]) => rx.test(n))?.[0] ?? 'unknown';
}

function normalizedLabelValue(
  line: string,
  labels: readonly string[],
): string | undefined {
  const n = normalizeForMatch(line);

  for (const label of labels) {
    const rx = new RegExp(
      `^${escapeRegExp(normalizeForMatch(label))}\\s+(.+)$`,
    );
    const match = n.match(rx);
    if (match?.[1]) return match[1].trim();
  }

  return undefined;
}

function isMotherboardLine(line: string): boolean {
  return /\b(?:PLACA[- ]?MAE|MOTHERBOARD|MAINBOARD)\b/.test(
    normalizeForMatch(line),
  );
}

function stripMotherboardLabel(line: string): string {
  return normalizeForMatch(line)
    .replace(
      /^.*?\b(?:PLACA[- ]?MAE|MOTHERBOARD|MAINBOARD)\b\s*/,
      '',
    )
    .replace(/^[\s:;#-]+|[\s:;#-]+$/g, '')
    .trim();
}

export function interpretOcrText(
  rawText: string,
  equipmentHint?: EquipmentCategory,
): OcrInterpretation {
  const normalizedText = normalizeOcrText(rawText);
  const lines = splitOcrLines(rawText);
  const fields: Partial<Record<OcrFieldKey, ExtractedField>> = {};
  const used = new Set<number>();

  const put = (
    key: OcrFieldKey,
    value: string | number | undefined,
    confidence: number,
    sourceLine: string,
    rule: string,
  ) => {
    if (value === undefined || value === null || value === '') return;

    const next: ExtractedField = {
      key,
      value,
      confidence: clampConfidence(confidence),
      sourceLine,
      rule,
    };

    const current = fields[key];

    if (!current || next.confidence > current.confidence) {
      fields[key] = next;
    }
  };

  const mark = (index: number) => used.add(index);

  // 1. Identificacao explicita.
  lines.forEach((line, index) => {
    const n = normalizeForMatch(line);

    const manufacturerValue = normalizedLabelValue(line, [
      'FABRICANTE',
      'MANUFACTURER',
      'MARCA',
    ]);

    if (manufacturerValue) {
      const match = matchManufacturer(manufacturerValue);

      put(
        'manufacturer',
        match?.name ?? manufacturerValue,
        match ? 0.99 : 0.91,
        line,
        'identity.manufacturer.label',
      );

      mark(index);
    }

    const modelValue = normalizedLabelValue(line, [
      'MODELO',
      'MODEL',
      'PRODUCT NAME',
      'PRODUTO',
    ]);

    if (modelValue) {
      put(
        'model',
        modelValue,
        0.98,
        line,
        'identity.model.label',
      );
      mark(index);
    }

    const serial = n.match(
      /\b(?:S\/?N|SN|SERIAL(?: NUMBER)?|NUMERO DE SERIE)\s+([A-Z0-9][A-Z0-9._/-]{3,})\b/,
    );

    if (serial) {
      put(
        'serial_number',
        serial[1],
        0.99,
        line,
        'identity.serial.label',
      );
      mark(index);
    }

    const partNumber = n.match(
      /\b(?:P\/?N|PART(?: NUMBER)?|PART NO)\s+([A-Z0-9][A-Z0-9._/-]{2,})\b/,
    );

    if (partNumber) {
      put(
        'part_number',
        partNumber[1],
        0.98,
        line,
        'identity.part_number.label',
      );
      mark(index);
    }

    const sku = n.match(
      /\bSKU\s+([A-Z0-9][A-Z0-9._/-]{2,})\b/,
    );

    if (sku) {
      put(
        'sku',
        sku[1],
        0.98,
        line,
        'identity.sku.label',
      );
      mark(index);
    }
  });

  // 2. Linha curta fabricante/modelo, ex.: LOGIN L500.
  if (!fields.manufacturer || !fields.model) {
    const componentContext =
      /\b(?:PLACA[- ]?MAE|MOTHERBOARD|MAINBOARD|PROCESSADOR|PROCESSOR|CPU|MEMORIA|RAM|SSD|HDD|NVME|WI-FI|WIFI|WLAN|WIRELESS|SISTEMA OPERACIONAL|WINDOWS|SERIAL|S\/?N|SKU|PART)\b/;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const n = normalizeForMatch(line);

      if (componentContext.test(n) || line.length > 80) continue;

      const match = matchManufacturer(n);
      if (!match) continue;

      if (!fields.manufacturer) {
        put(
          'manufacturer',
          match.name,
          match.confidence,
          line,
          match.fuzzy
            ? 'identity.manufacturer.fuzzy'
            : 'identity.manufacturer.alias',
        );
      }

      if (!fields.model) {
        const normalizedAlias = normalizeForMatch(match.alias);
        const aliasRx = new RegExp(
          `(^|\\s)${escapeRegExp(normalizedAlias)}(?=\\s|$)`,
        );

        const remainder = n
          .replace(aliasRx, ' ')
          .replace(/^[\s:;#-]+|[\s:;#-]+$/g, '')
          .trim();

        const modelCandidate = remainder.match(
          /\b[A-Z0-9][A-Z0-9._/-]{1,}\b/,
        )?.[0];

        if (
          modelCandidate &&
          normalizeForMatch(modelCandidate) !== normalizeForMatch(match.name)
        ) {
          put(
            'model',
            modelCandidate,
            0.9,
            line,
            'identity.model.after_manufacturer',
          );
        }
      }

      mark(index);

      if (fields.manufacturer && fields.model) break;
    }
  }

  // 3. Processador.
  lines.forEach((line, index) => {
    const n = normalizeForMatch(line);

    if (
      !/PROCESSADOR|PROCESSOR|CPU|RYZEN|CORE|XEON|CELERON|PENTIUM/.test(n)
    ) {
      return;
    }

    const amd = n.match(
      /\b(?:AMD\s+)?(RYZEN\s+[3579]\s+\d{4,5}[A-Z]{0,3})\b/,
    );

    if (amd) {
      put(
        'processor_manufacturer',
        'AMD',
        0.99,
        line,
        'cpu.amd',
      );

      put(
        'processor_model',
        `AMD ${amd[1].replace(/\s+/g, ' ').trim()}`,
        0.99,
        line,
        'cpu.amd',
      );

      mark(index);
      return;
    }

    const intel = n.match(
      /\b(?:INTEL\s+)?((?:CORE\s+(?:ULTRA\s+)?I?[3579][\s-]?[A-Z0-9-]+)|XEON\s+[A-Z0-9-]+|CELERON\s+[A-Z0-9-]+|PENTIUM\s+[A-Z0-9-]+)\b/,
    );

    if (intel) {
      put(
        'processor_manufacturer',
        'Intel',
        0.99,
        line,
        'cpu.intel',
      );

      put(
        'processor_model',
        `Intel ${intel[1].replace(/\s+/g, ' ').trim()}`,
        0.99,
        line,
        'cpu.intel',
      );

      mark(index);
    }
  });

  // 4. Memoria.
  lines.forEach((line, index) => {
    const n = normalizeForMatch(line);

    const memory = n.match(
      /\b(\d{1,3})\s*GB\b.*?\b(DDR[345]|LPDDR[345X]+)\b(?:.*?\b(\d{3,5})\s*(?:MHZ|MT\/S|MTS)\b)?/,
    );

    if (!memory) return;

    put(
      'memory_total_gb',
      Number(memory[1]),
      0.99,
      line,
      'memory.capacity',
    );

    put(
      'memory_type',
      memory[2],
      0.99,
      line,
      'memory.type',
    );

    if (memory[3]) {
      put(
        'memory_speed_mhz',
        Number(memory[3]),
        0.98,
        line,
        'memory.speed',
      );
    }

    mark(index);
  });

  // 5. Armazenamento.
  lines.forEach((line, index) => {
    const n = normalizeForMatch(line);

    if (!/ARMAZENAMENTO|STORAGE|SSD|HDD|NVME|M\.2|EMMC/.test(n)) {
      return;
    }

    const capacity = n.match(
      /\b(\d+(?:[.,]\d+)?)\s*(TB|GB)\b/,
    );

    if (capacity) {
      const base = Number(capacity[1].replace(',', '.'));

      const gb =
        capacity[2] === 'TB'
          ? Math.round(base * 1024)
          : Math.round(base);

      put(
        'storage_capacity_gb',
        gb,
        0.98,
        line,
        'storage.capacity',
      );
    }

    if (/\bSSD\b|\bNVME\b/.test(n)) {
      put(
        'storage_type',
        'SSD',
        0.98,
        line,
        'storage.type.ssd',
      );
    } else if (
      /\bHDD\b|HARD DISK|DISCO RIGIDO/.test(n)
    ) {
      put(
        'storage_type',
        'HDD',
        0.98,
        line,
        'storage.type.hdd',
      );
    } else if (/\bEMMC\b/.test(n)) {
      put(
        'storage_type',
        'eMMC',
        0.98,
        line,
        'storage.type.emmc',
      );
    }

    if (/\bNVME\b/.test(n)) {
      put(
        'storage_interface',
        'NVMe',
        0.99,
        line,
        'storage.interface.nvme',
      );
    } else if (/\bSATA\b/.test(n)) {
      put(
        'storage_interface',
        'SATA',
        0.98,
        line,
        'storage.interface.sata',
      );
    }

    const m2 = n.match(
      /\bM\.?2\s*(2242|2260|2280|22110)?\b/,
    );

    if (m2) {
      put(
        'storage_form_factor',
        m2[1] ? `M.2 ${m2[1]}` : 'M.2',
        0.98,
        line,
        'storage.form_factor.m2',
      );
    } else if (
      /\b2[.,]5\s*(?:POL|IN|POLEGADAS)?\b/.test(n)
    ) {
      put(
        'storage_form_factor',
        '2.5"',
        0.95,
        line,
        'storage.form_factor.2_5',
      );
    } else if (
      /\b3[.,]5\s*(?:POL|IN|POLEGADAS)?\b/.test(n)
    ) {
      put(
        'storage_form_factor',
        '3.5"',
        0.95,
        line,
        'storage.form_factor.3_5',
      );
    }

    mark(index);
  });

  // 6. Placa-mae.
  lines.forEach((line, index) => {
    if (!isMotherboardLine(line)) {
      return;
    }

    const remainder = stripMotherboardLabel(line);

    if (!remainder) {
      mark(index);
      return;
    }

    const match = matchManufacturer(remainder);

    if (match) {
      put(
        'motherboard_manufacturer',
        match.name,
        match.confidence,
        line,
        'motherboard.manufacturer',
      );

      const normalizedAlias = normalizeForMatch(match.alias);

      const model = remainder
        .replace(
          new RegExp(
            `(^|\\s)${escapeRegExp(normalizedAlias)}(?=\\s|$)`,
          ),
          ' ',
        )
        .replace(/^[\s:;#-]+|[\s:;#-]+$/g, '')
        .trim();

      if (model) {
        put(
          'motherboard_model',
          model,
          0.95,
          line,
          'motherboard.model',
        );
      }
    } else {
      put(
        'motherboard_model',
        remainder,
        0.86,
        line,
        'motherboard.model.unmatched',
      );
    }

    mark(index);
  });

  // 7. Sistema operacional.
  lines.forEach((line, index) => {
    const n = normalizeForMatch(line);

    const windows = n.match(
      /\b(?:MS\s+|MICROSOFT\s+)?WINDOWS\s+(11|10|8(?:\.1)?|7)\s*(PRO|HOME|ENTERPRISE|EDUCATION|PROFESSIONAL)?\b/,
    );

    if (windows) {
      const edition = windows[2]
        ? ` ${windows[2][0]}${windows[2].slice(1).toLowerCase()}`
        : '';

      put(
        'operating_system',
        `Windows ${windows[1]}${edition}`,
        0.99,
        line,
        'os.windows',
      );

      mark(index);
      return;
    }

    const linux = n.match(
      /\b(UBUNTU|DEBIAN|FEDORA|CENTOS|RED HAT|RHEL|LINUX MINT)\b(?:\s+([0-9.]+))?/,
    );

    if (linux) {
      put(
        'operating_system',
        `${linux[1]}${linux[2] ? ` ${linux[2]}` : ''}`,
        0.94,
        line,
        'os.linux',
      );

      mark(index);
    }
  });

  // 8. Rede / Wi-Fi.
  lines.forEach((line, index) => {
    const n = normalizeForMatch(line);

    if (!/(WI-FI|WIFI|WLAN|WIRELESS|REDE)/.test(n)) {
      return;
    }

    const match = matchManufacturer(n);

    if (
      match &&
      ['Intel', 'Realtek', 'Qualcomm', 'Broadcom'].includes(match.name)
    ) {
      put(
        'wifi_manufacturer',
        match.name,
        match.confidence,
        line,
        'wifi.manufacturer',
      );
    } else if (/\bINTEL\b/.test(n)) {
      put(
        'wifi_manufacturer',
        'Intel',
        0.99,
        line,
        'wifi.manufacturer.intel',
      );
    }

    const model = n.match(
      /\b(?:INTEL\s+)?([A-Z]{0,4}\d{3,5}[A-Z0-9-]*)\b/,
    );

    if (model) {
      put(
        'wifi_model',
        model[1],
        0.94,
        line,
        'wifi.model',
      );
    }

    mark(index);
  });

  // 9. MAC address.
  lines.forEach((line, index) => {
    const n = normalizeForMatch(line);

    const mac = n.match(
      /\b(?:MAC(?: ADDRESS)?\s*)?((?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2})\b/,
    );

    if (!mac) return;

    put(
      'mac_address',
      mac[1].toUpperCase().replace(/-/g, ':'),
      0.99,
      line,
      'network.mac',
    );

    mark(index);
  });

  // 10. Dados eletricos.
  lines.forEach((line, index) => {
    const n = normalizeForMatch(line);

    const voltage = n.match(
      /\b(\d{2,3}(?:\s*[-~]\s*\d{2,3})?)\s*V(?:AC)?\b/,
    );

    const frequency = n.match(
      /\b(50|60)(?:\s*\/\s*(50|60))?\s*HZ\b/,
    );

    const power = n.match(
      /\b(\d{2,5})\s*W\b/,
    );

    if (voltage) {
      put(
        'input_voltage',
        voltage[1].replace(/\s+/g, ''),
        0.94,
        line,
        'electrical.voltage',
      );
    }

    if (frequency) {
      put(
        'frequency_hz',
        frequency[2]
          ? `${frequency[1]}/${frequency[2]}`
          : Number(frequency[1]),
        0.94,
        line,
        'electrical.frequency',
      );
    }

    if (power) {
      put(
        'power_w',
        Number(power[1]),
        0.94,
        line,
        'electrical.power',
      );
    }

    if (voltage || frequency || power) {
      mark(index);
    }
  });

  const unclassifiedLines = lines.filter((line, index) => {
    if (used.has(index)) return false;
    if (isOcrMarker(line)) return false;

    if (
      detectCategory(line) !== 'unknown' &&
      line.trim().split(/\s+/).length <= 3
    ) {
      return false;
    }

    return line.trim().length > 1;
  });

  const extracted = Object.values(fields).filter(
    (field): field is ExtractedField => Boolean(field),
  );

  const confidence = extracted.length
    ? clampConfidence(
        extracted.reduce(
          (sum, field) => sum + field.confidence,
          0,
        ) / extracted.length,
      )
    : 0;

  return {
    rawText,
    normalizedText,
    detectedCategory:
      equipmentHint && equipmentHint !== 'unknown'
        ? equipmentHint
        : detectCategory(rawText),
    confidence,
    fields,
    unclassifiedLines,
    observations: unclassifiedLines.join('\n'),
  };
}

export function buildAssetPrefill(
  rawText: string,
  equipmentHint?: EquipmentCategory,
): AssetPrefill {
  const extraction = interpretOcrText(rawText, equipmentHint);

  const value = <T extends string | number>(
    key: OcrFieldKey,
  ): T | undefined =>
    extraction.fields[key]?.value as T | undefined;

  return {
    type: extraction.detectedCategory,
    manufacturer: value<string>('manufacturer'),
    model: value<string>('model'),
    serialNumber: value<string>('serial_number'),
    partNumber: value<string>('part_number'),
    sku: value<string>('sku'),
    processor: {
      manufacturer: value<string>('processor_manufacturer'),
      model: value<string>('processor_model'),
    },
    memory: {
      totalGb: value<number>('memory_total_gb'),
      type: value<string>('memory_type'),
      speedMhz: value<number>('memory_speed_mhz'),
    },
    storage: {
      capacityGb: value<number>('storage_capacity_gb'),
      type: value<string>('storage_type'),
      interface: value<string>('storage_interface'),
      formFactor: value<string>('storage_form_factor'),
    },
    motherboard: {
      manufacturer: value<string>('motherboard_manufacturer'),
      model: value<string>('motherboard_model'),
    },
    operatingSystem: value<string>('operating_system'),
    wifi: {
      manufacturer: value<string>('wifi_manufacturer'),
      model: value<string>('wifi_model'),
    },
    macAddress: value<string>('mac_address'),
    observations: extraction.observations || undefined,
    extraction,
  };
}

