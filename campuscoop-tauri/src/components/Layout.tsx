import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Users,
  ShieldAlert,
  Package,
  Mail,
  BarChart3,
  Settings as SettingsIcon,
  AlertTriangle,
  LogOut,
  Menu,
  X,
  Layout,
} from 'lucide-react';
import {
  DashboardPage,
  ApplicationsPage,
  CommodityPage,
  RegularPage,
  ShortTermPage,
  MembersPage,
  PaymentsPage,
  TreasurerPage,
  SettingsPage,
  MemberHomePage,
} from './Sections';

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'purple';
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, color: 'blue' },
  { label: 'Loan Applications', href: '/app/applications', icon: FileText, color: 'amber' },
  { label: 'Members', href: '/app/members', icon: Users, color: 'green' },
  { label: 'Short Term Loans', href: '/app/shortterm', icon: CreditCard, color: 'blue' },
  { label: 'Regular Loans', href: '/app/regular', icon: Users, color: 'green' },
  { label: 'Commodity Loans', href: '/app/commodity', icon: Package, color: 'amber' },
  { label: 'Payments', href: '/app/payments', icon: CreditCard, color: 'green' },
  { label: 'Treasurer Release', href: '/app/treasurer', icon: ShieldAlert, color: 'red' },
  { label: 'Settings', href: '/app/settings', icon: SettingsIcon, color: 'gray' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('cc_user');
    localStorage.removeItem('cc_role');
    navigate('/login');
  };

  const isMemberView = location.pathname === '/app/member-home';

  // Route to component mapping
  const routeComponent: Record<string, React.ElementType> = {
    '/app/dashboard': DashboardPage,
    '/app/applications': ApplicationsPage,
    '/app/commodity': CommodityPage,
    '/app/regular': RegularPage,
    '/app/shortterm': ShortTermPage,
    '/app/members': MembersPage,
    '/app/payments': PaymentsPage,
    '/app/treasurer': TreasurerPage,
    '/app/settings': SettingsPage,
    '/app/member-home': MemberHomePage,
  };

  const PageComponent = routeComponent[location.pathname] || DashboardPage;

  return (
    <div className="min-h-screen bg-coop-bg">
      {/* Mobile overlay */}
      {sidebarOpen && !isMemberView && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (admin only) */}
      {!isMemberView && (
        <aside
          className={`fixed left-0 top-0 h-full w-64 bg-coop-dark text-white z-30 transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative md:shadow-lg`}
        >
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-coop-light rounded-lg flex items-center justify-center">
                <Layout className="w-5 h-5 text-coop-dark" />
              </div>
              <div>
                <h1 className="font-bold text-xl tracking-tight">CAMPUS<span className="text-coop-light">COOP</span></h1>
                <p className="text-xs text-gray-400">SKSU Cooperative Loan System</p>
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.href;
              const colorClasses: Record<string, string> = {
                blue: 'bg-blue-500/20 text-blue-400',
                green: 'bg-green-500/20 text-green-400',
                amber: 'bg-amber-500/20 text-amber-400',
                red: 'bg-red-500/20 text-red-400',
                gray: 'bg-gray-500/20 text-gray-400',
                purple: 'bg-purple-500/20 text-purple-400',
              };
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.href)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-coop-dark/50 text-white border-r-2 border-coop-light shadow-sm'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                  }`}
                >
                  <div className={`w-7 h-7 rounded flex items-center justify-center ${colorClasses[item.color]}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="absolute bottom-0 w-full p-4 border-t border-gray-700">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className={`transition-all duration-300 ${!isMemberView ? 'md:pl-64' : ''}`}>
        {/* Top Nav (admin) */}
        {!isMemberView && (
          <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-coop-dark"
                >
                  {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                <h2 className="font-bold text-lg text-coop-dark">CampusCoop Admin</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                  <Layout className="w-4 h-4 text-gray-400" />
                  <span>AY 2025-2026</span>
                </div>
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-coop-dark">Admin Officer</p>
                    <p className="text-xs text-gray-500">masteradmin</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-coop-light flex items-center justify-center text-coop-dark font-bold">
                    A
                  </div>
                </div>
              </div>
            </div>
          </header>
        )}

        <main className="p-4 md:p-6">{children ?? <PageComponent />}</main>
      </div>
    </div>
  );
}
