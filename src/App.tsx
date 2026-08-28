import {
  Navigate,
  Route,
  Routes,
} from 'react-router'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { isSupabaseConfigured } from './lib/supabase'
import { AlertsPage } from './pages/AlertsPage'
import { AssetCodePage } from './pages/AssetCodePage'
import { AssetDetailPage } from './pages/AssetDetailPage'
import { AssetsPage } from './pages/AssetsPage'
import { AuditExecutionPage } from './pages/AuditExecutionPage'
import { AuditsPage } from './pages/AuditsPage'
import { BackendSetupPage } from './pages/BackendSetupPage'
import { DashboardPage } from './pages/DashboardPage'
import { InventoryPage } from './pages/InventoryPage'
import { LocationsPage } from './pages/LocationsPage'
import { LoginPage } from './pages/LoginPage'
import { LogsPage } from './pages/LogsPage'
import { MaintenanceDetailPage } from './pages/MaintenanceDetailPage'
import { MaintenancePage } from './pages/MaintenancePage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StockDetailPage } from './pages/StockDetailPage'
import { UnauthorizedPage } from './pages/UnauthorizedPage'
import { UsersPage } from './pages/UsersPage'

import { FieldScannerPage } from './pages/FieldScannerPage'
import { IdentifyCodePage } from './pages/IdentifyCodePage'
import { LabelsPage } from './pages/LabelsPage'
import { PendingRegistrationsPage } from './pages/PendingRegistrationsPage'
export default function App() {
  if (!isSupabaseConfigured) {
    return <BackendSetupPage />
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            element={
              <ProtectedRoute permission="dashboard.view" />
            }
          >
            <Route
              path="/dashboard"
              element={<DashboardPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute permission="assets.view" />
            }
          >
            <Route
              path="/patrimonio"
              element={<AssetsPage />}
            />
            <Route
              path="/patrimonio/:assetId"
              element={<AssetDetailPage />}
            />
            <Route
              path="/ativo/:assetCode"
              element={<AssetCodePage />}
            />
            <Route
              path="/manutencoes"
              element={<MaintenancePage />}
            />
            <Route
              path="/manutencoes/:maintenanceId"
              element={<MaintenanceDetailPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute permission="stock.view" />
            }
          >
            <Route
              path="/estoque"
              element={<InventoryPage />}
            />
            <Route
              path="/estoque/:stockUnitId"
              element={<StockDetailPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute permission="audits.view" />
            }
          >
            <Route
              path="/auditorias"
              element={<AuditsPage />}
            />
            <Route
              path="/auditorias/:auditId"
              element={<AuditExecutionPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute permission="alerts.view" />
            }
          >
            <Route
              path="/alertas"
              element={<AlertsPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute permission="locations.view" />
            }
          >
            <Route
              path="/ambientes"
              element={<LocationsPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute permission="reports.view" />
            }
          >
            <Route
              path="/relatorios"
              element={<ReportsPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute permission="users.view" />
            }
          >
            <Route
              path="/usuarios"
              element={<UsersPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute permission="logs.view" />
            }
          >
            <Route
              path="/logs"
              element={<LogsPage />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute permission="settings.view" />
            }
          >
            <Route
              path="/configuracoes"
              element={<SettingsPage />}
            />
          </Route>
          <Route
            element={
              <ProtectedRoute permission="assets.view" />
            }
          >
            <Route
              path="/escanear"
              element={<FieldScannerPage />}
            />
            <Route
              path="/identificar/:code"
              element={<IdentifyCodePage />}
            />
            <Route
              path="/etiquetas"
              element={<LabelsPage />}
            />
            <Route
              path="/pendencias-cadastro"
              element={<PendingRegistrationsPage />}
            />
          </Route>

          <Route
            path="/sem-permissao"
            element={<UnauthorizedPage />}
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />
        </Route>
      </Route>
    </Routes>
  )
}
