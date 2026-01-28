import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Utensils, 
  LogOut, 
  Users, 
  ClipboardList, 
  CalendarCheck,
  LayoutDashboard,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from 'react-router-dom';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'student':
        return 'Student';
      default:
        return 'User';
    }
  };

  const getNavItems = () => {
    const items = [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ];

    if (role === 'super_admin') {
      items.push(
        { to: '/manage-users', icon: Users, label: 'Manage Users' },
        { to: '/reports', icon: ClipboardList, label: 'Reports' }
      );
    } else if (role === 'admin') {
      items.push(
        { to: '/reports', icon: ClipboardList, label: 'Daily Reports' }
      );
    } else if (role === 'student') {
      items.push(
        { to: '/attendance', icon: CalendarCheck, label: 'My Attendance' }
      );
    }

    return items;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Utensils className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-lg">Hostel Mess</h1>
              <p className="text-xs text-muted-foreground">Management System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {getNavItems().map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground">{getRoleLabel(role)}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}