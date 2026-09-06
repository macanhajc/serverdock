import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AvatarCircle, Docker, Gear, Home, Logout, Shield, ShieldSharp, Users, Wifi } from 'pixelarticons/react';
import { LangSwitcher, SidebarNav } from '../../components';
import { ServerEventsBridge } from '../../components/core/ServerEventsBridge';
import { DashboardMain } from './Dashboard';
import ServerDetail from './ServerDetail';
import GameForm from './GameForm';
import VisitorsPage from './VisitorsPage';
import NetworkPage from './NetworkPage';
import SettingsPage from './SettingsPage';
import DockerPage from './DockerPage';
import AdminsPage from './AdminsPage';

type NavValue =
  | 'dashboard'
  | 'servers'
  | 'visitors'
  | 'network'
  | 'docker'
  | 'admins'
  | 'settings';

function useActiveNav(location: { pathname: string }): NavValue {
  if (location.pathname === '/admin/servers') return 'servers';
  if (location.pathname.startsWith('/admin/visitors')) return 'visitors';
  if (location.pathname.startsWith('/admin/network')) return 'network';
  if (location.pathname.startsWith('/admin/docker')) return 'docker';
  if (location.pathname.startsWith('/admin/admins')) return 'admins';
  if (location.pathname.startsWith('/admin/settings')) return 'settings';
  return 'dashboard';
}

// A plain admin who navigates straight to /admin/admins (bookmark, typed URL)
// gets bounced back — the real boundary is every /api/admins/* route already
// requiring super_admin server-side, this just avoids showing a dead page.
function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? <>{children}</> : <Navigate to="/admin" replace />;
}

export default function PrivateRoute() {
  const { t } = useTranslation();
  const { logout, socketConnected, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const active = useActiveNav(location);

  const navItems = [
    { value: 'dashboard', label: t('adminDashboard.navDashboard'), icon: Home },
    { value: 'visitors', label: t('adminDashboard.navVisitors'), icon: Users },
    { value: 'network', label: t('adminDashboard.navNetwork'), icon: Wifi },
    { value: 'docker', label: t('docker.navTitle'), icon: Docker },
    ...(isSuperAdmin ? [{ value: 'admins', label: t('admins.navTitle'), icon: AvatarCircle }] : []),
    { value: 'settings', label: t('settings.title'), icon: Gear },
  ];

  function handleNav(value: string) {
    const routes: Record<string, string> = {
      dashboard: '/admin',
      servers: '/admin/servers',
      visitors: '/admin/visitors',
      network: '/admin/network',
      docker: '/admin/docker',
      admins: '/admin/admins',
      settings: '/admin/settings',
    };
    if (routes[value]) navigate(routes[value]);
  }

  function handleLogout() {
    logout();
    navigate('/auth', { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <ServerEventsBridge />

      <SidebarNav
        items={navItems}
        active={active}
        onSelect={handleNav}
        footer={<LangSwitcher />}
        onLogout={handleLogout}
        logoutLabel={t('adminDashboard.navLogout')}
        LogoutIcon={Logout}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <Routes>
          <Route index element={<DashboardMain navigate={navigate} />} />
          <Route path="servers/:id/*" element={<ServerDetail />} />
          <Route path="servers/new" element={<GameForm />} />
          <Route path="servers/:id/edit" element={<GameForm />} />
          <Route path="visitors" element={<VisitorsPage />} />
          <Route path="network" element={<NetworkPage />} />
          <Route path="docker" element={<DockerPage />} />
          <Route
            path="admins"
            element={
              <SuperAdminRoute>
                <AdminsPage />
              </SuperAdminRoute>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
