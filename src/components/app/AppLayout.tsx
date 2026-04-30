import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { Brain, LayoutDashboard, Users, Calendar, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { to: "/app", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/app/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/perfil", label: "Perfil", icon: Settings },
];

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
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 bg-card border-r border-border flex-col">
        <Link to="/app" className="p-6 flex items-center gap-2 border-b border-border">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground">
            <Brain className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold">
            Psi <span className="italic text-accent">Real</span>
          </span>
        </Link>

        <nav className="flex-1 p-4 space-y-1">
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

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-card/90 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4">
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
        <nav className="flex border-t border-border overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex-1 min-w-[80px] flex flex-col items-center gap-1 px-3 py-2 text-xs",
                  isActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main */}
      <main className="flex-1 md:overflow-x-hidden pt-32 md:pt-0">
        <div className="p-6 lg:p-10 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
