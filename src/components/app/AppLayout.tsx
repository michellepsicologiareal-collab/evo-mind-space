import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { Brain, LayoutDashboard, Users, Calendar, Wallet, Settings, LogOut, GraduationCap, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { to: "/app", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/app/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/app/supervisionandos", label: "Supervisionandos", icon: GraduationCap },
  { to: "/app/supervisao", label: "Supervisão", icon: ShieldCheck },
  { to: "/app/perfil", label: "Perfil", icon: Settings },
];

/* Mobile bottom bar — show first 5 items */
const mobileNavItems = navItems.slice(0, 5);

export const AppLayout = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sessão encerrada.");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-soft flex">
      {/* ── Desktop sidebar (fixed) ── */}
      <aside className="hidden md:flex md:w-64 lg:w-72 fixed inset-y-0 left-0 z-30 bg-card border-r border-border flex-col">
        <Link to="/app" className="p-6 flex items-center gap-2 border-b border-border">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground">
            <Brain className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold">
            Psi <span className="italic text-accent">Real</span>
          </span>
        </Link>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground truncate mb-3">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* ── Mobile top header ── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/app" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground">
              <Brain className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">Psi <span className="italic text-accent">Real</span></span>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Mobile bottom nav (fixed, app-native feel) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
        <div className="flex justify-around py-1">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors rounded-lg",
                  isActive ? "text-accent" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-64 lg:ml-72 pt-16 pb-20 md:pt-0 md:pb-0">
        <div className="p-6 lg:p-10 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
