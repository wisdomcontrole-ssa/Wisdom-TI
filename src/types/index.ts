export type AssetStatus =
  | 'operational'
  | 'attention'
  | 'maintenance'
  | 'stock'
  | 'retired'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface Asset {
  id: string
  code: string
  type: string
  name: string
  manufacturer: string
  model: string
  serial: string
  unit: string
  location: string
  status: AssetStatus
  lastAudit: string
}

export interface SystemAlert {
  id: string
  assetCode: string
  assetName: string
  title: string
  description: string
  severity: AlertSeverity
  detectedAt: string
  location: string
}