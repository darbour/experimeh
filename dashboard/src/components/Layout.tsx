import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FlaskConical,
  BarChart3,
  Plus,
  Moon,
  Sun,
  Menu,
  X,
  Activity,
} from 'lucide-react';
import { useConnectionStatus } from '../hooks/useRealtime';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isConnected, lastUpdate } = useConnectionStatus();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Experiments', href: '/experiments', icon: FlaskConical },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 hidden md:block`}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
              {sidebarOpen ? (
                <>
                  <div className="flex items-center space-x-2">
                    <FlaskConical className="w-8 h-8 text-primary-600" />
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      ExperimentHub
                    </span>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 mx-auto"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3">{item.name}</span>}
                  </Link>
                );
              })}
            </nav>

            {/* Create New Experiment Button */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <Link
                to="/experiments/new"
                className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors ${
                  !sidebarOpen ? 'p-2' : ''
                }`}
              >
                <Plus className="w-5 h-5" />
                {sidebarOpen && <span className="ml-2">New Experiment</span>}
              </Link>
            </div>
          </div>
        </aside>

        {/* Mobile sidebar */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="fixed inset-0 bg-gray-600 bg-opacity-75"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-xl">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <FlaskConical className="w-8 h-8 text-primary-600" />
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      ExperimentHub
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-1">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive(item.href)
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="ml-3">{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between h-16 px-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
              >
                <Menu className="w-6 h-6" />
              </button>

              <div className="flex-1 md:flex-none" />

              <div className="flex items-center space-x-4">
                {/* Connection status */}
                <div className="flex items-center space-x-2 text-sm">
                  <Activity
                    className={`w-4 h-4 ${
                      isConnected ? 'text-green-500' : 'text-red-500'
                    }`}
                  />
                  <span className="text-gray-600 dark:text-gray-400 hidden sm:inline">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                {/* Dark mode toggle */}
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {darkMode ? (
                    <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
