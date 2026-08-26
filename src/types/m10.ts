export interface DashboardSummary {
  assets: {
    total: number
    active: number
    stock: number
    maintenance: number
    retired: number
    disposed: number
    without_location: number
  }
  stock: {
    total: number
    in_stock: number
    installed: number
    maintenance: number
    disposed: number
  }
  audits: {
    in_progress: number
    closed: number
    pending_items: number
    missing_items: number
    divergent_items: number
  }
  maintenance: {
    active: number
    critical: number
    completed_30d: number
  }
  alerts: {
    open: number
    acknowledged: number
    critical: number
  }
  agents: {
    active: number
    online: number
    offline: number
    open_divergences: number
  }
  recent_alerts: Array<{
    id: string
    title: string
    category: string
    severity: string
    status: string
    detected_at: string
    asset_code: string | null
  }>
  recent_maintenance: Array<{
    id: string
    maintenance_code: string
    status: string
    priority: string
    opened_at: string
    asset_code: string
  }>
}

export type ReportKind =
  | 'assets'
  | 'stock'
  | 'audits'
  | 'maintenance'
  | 'alerts'
  | 'agents'

export type ReportRow =
  Record<string, unknown>
