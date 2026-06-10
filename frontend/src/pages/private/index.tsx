import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LangSwitcher, SidebarNav } from '../../components';
import { ServerEventsBridge } from '../../components/core/ServerEventsBridge';
import { DashboardMain } from './Dashboard';
import ServerDetail from './ServerDetail';
import GameForm from './GameForm';
import VisitorsPage from './VisitorsPage';
import NetworkPage from './NetworkPage';
import SettingsPage from './SettingsPage';
import DockerPage from './DockerPage';

type NavValue = 'dashboard' | 'servers' | 'visitors' | 'network' | 'docker' | 'settings' | 'logout';

function useActiveNav(location: { pathname: string }): NavValue {
  if (location.pathname === '/admin/servers') return 'servers';
  if (location.pathname.startsWith('/admin/visitors')) return 'visitors';
  if (location.pathname.startsWith('/admin/network')) return 'network';
  if (location.pathname.startsWith('/admin/docker')) return 'docker';
  if (location.pathname.startsWith('/admin/settings')) return 'settings';
  return 'dashboard';
}

export default function PrivateRoute() {
  const { t } = useTranslation();
  const { logout, socketConnected } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const active = useActiveNav(location);

  const navItems = [
    { value: 'dashboard', label: t('adminDashboard.navDashboard') },
    { divider: true },
    { value: 'visitors', label: t('adminDashboard.navVisitors') },
    { value: 'network', label: t('adminDashboard.navNetwork') },
    { value: 'docker', label: t('docker.navTitle') },
    { value: 'settings', label: t('settings.title') },
    { divider: true },
    { value: 'logout', label: t('adminDashboard.navLogout'), danger: true },
  ];

  function handleNav(value: string) {
    if (value === 'logout') {
      logout();
      navigate('/auth', { replace: true });
      return;
    }
    const routes: Record<string, string> = {
      dashboard: '/admin',
      servers: '/admin/servers',
      visitors: '/admin/visitors',
      network: '/admin/network',
      docker: '/admin/docker',
      settings: '/admin/settings',
    };
    if (routes[value]) navigate(routes[value]);
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <ServerEventsBridge />
      <SidebarNav
        items={navItems}
        active={active}
        onSelect={handleNav}
        footer={
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span>{t('adminDashboard.footerText')}</span>
              {!socketConnected && (
                <span className="ml-auto text-red">{t('adminDashboard.offlineWarning')}</span>
              )}
            </div>

            <LangSwitcher />
          </div>
        }
        className="min-h-screen z-10 fixed"
      />

      <main className="flex-1 min-w-0 ml-52">
        <Routes>
          <Route index element={<DashboardMain navigate={navigate} />} />
          <Route path="servers/:id/*" element={<ServerDetail />} />
          <Route path="servers/new" element={<GameForm />} />
          <Route path="servers/:id/edit" element={<GameForm />} />
          <Route path="visitors" element={<VisitorsPage />} />
          <Route path="network" element={<NetworkPage />} />
          <Route path="docker" element={<DockerPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
