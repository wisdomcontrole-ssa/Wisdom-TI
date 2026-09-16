export type EquipmentCategory =
  | 'desktop'
  | 'notebook'
  | 'server'
  | 'monitor'
  | 'printer'
  | 'switch'
  | 'router'
  | 'access_point'
  | 'firewall'
  | 'ups'
  | 'stabilizer'
  | 'power_strip'
  | 'projector'
  | 'keyboard'
  | 'mouse'
  | 'scanner'
  | 'barcode_scanner'
  | 'webcam'
  | 'dock'
  | 'nas'
  | 'unknown';

export type OcrFieldKey =
  | 'manufacturer'
  | 'model'
  | 'serial_number'
  | 'part_number'
  | 'sku'
  | 'processor_manufacturer'
  | 'processor_model'
  | 'memory_total_gb'
  | 'memory_type'
  | 'memory_speed_mhz'
  | 'storage_capacity_gb'
  | 'storage_type'
  | 'storage_interface'
  | 'storage_form_factor'
  | 'motherboard_manufacturer'
  | 'motherboard_model'
  | 'operating_system'
  | 'wifi_manufacturer'
  | 'wifi_model'
  | 'mac_address'
  | 'input_voltage'
  | 'frequency_hz'
  | 'power_w';

export type ExtractedValue = string | number;

export interface ExtractedField {
  key: OcrFieldKey;
  value: ExtractedValue;
  confidence: number;
  sourceLine: string;
  rule: string;
}

export interface OcrInterpretation {
  rawText: string;
  normalizedText: string;
  detectedCategory: EquipmentCategory;
  confidence: number;
  fields: Partial<Record<OcrFieldKey, ExtractedField>>;
  unclassifiedLines: string[];
  observations: string;
}

export interface AssetPrefill {
  type?: EquipmentCategory;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  partNumber?: string;
  sku?: string;
  processor?: {
    manufacturer?: string;
    model?: string;
  };
  memory?: {
    totalGb?: number;
    type?: string;
    speedMhz?: number;
  };
  storage?: {
    capacityGb?: number;
    type?: string;
    interface?: string;
    formFactor?: string;
  };
  motherboard?: {
    manufacturer?: string;
    model?: string;
  };
  operatingSystem?: string;
  wifi?: {
    manufacturer?: string;
    model?: string;
  };
  macAddress?: string;
  observations?: string;
  extraction: OcrInterpretation;
}
