import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Clock, 
  Receipt, 
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/Placements', label: 'Placements', icon: Users },
  { path: '/Contracts', label: 'Contracten', icon: FileText },
  { path: '/Timesheets', label: 'Timesheets', icon: Clock },
  { path: '/Billing', label: 'Facturatie', icon: Receipt },
  { path: '/Reports', label: 'Rapportering', icon: BarChart3 },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className={cn("flex items-center border-b border-sidebar-border", collapsed ? "justify-center py-4 px-2 h-16" : "px-5 py-4 gap-3 h-16")}>
        <div className="flex-shrink-0 w-8 h-8 bg-sidebar-primary rounded-sm flex items-center justify-center">
          <span className="text-white font-black text-sm leading-none">L</span>
        </div>
        {!collapsed && (
          <div className="leading-none">
            <div className="text-white font-bold text-base tracking-tight">Lighttrack</div>
            <div className="text-sidebar-foreground/40 text-[10px] tracking-widest uppercase mt-0.5">by dark light.</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20" 
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={onToggle}
        className="mx-2 mb-4 p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/60"
      >
        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </aside>
  );
}