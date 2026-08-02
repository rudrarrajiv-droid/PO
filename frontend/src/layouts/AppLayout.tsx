import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Database, PackageSearch, Activity, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Job Cards', path: '/job-cards', icon: FileText },
    { name: 'Master Data', path: '/master-data', icon: Database },
    { name: 'Reel Inventory', path: '/inventory', icon: PackageSearch },
    { name: 'Tracker', path: '/production', icon: Activity },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col">
        <div className="p-6 flex flex-col items-start">
          <img src="/logo.gif" alt="Packwell India Logo" className="w-32 object-contain mb-2" />
          <p className="text-xs text-muted-foreground">Industrial Job Card System</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center px-4 py-3 rounded-md transition-colors text-sm font-medium",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow" 
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                )}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button 
            onClick={handleLogout}
            className="flex items-center px-4 py-3 w-full rounded-md transition-colors text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8">
          <h2 className="text-lg font-semibold text-foreground">
            {navItems.find(i => location.pathname.startsWith(i.path))?.name || 'Packwell India'}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="text-right flex flex-col justify-center">
              <span className="text-sm text-foreground font-medium">{user?.name || 'User'}</span>
              <span className="text-xs text-muted-foreground">{user?.role || 'Guest'}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-[#F4F6F9] dark:bg-background p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
