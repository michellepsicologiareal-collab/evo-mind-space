import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { Brain, LayoutDashboard, Users, Calendar, Wallet, Settings, LogOut, GraduationCap, ShieldCheck, Crown, Lock, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PlanModal } from "@/components/app/PlanModal";
import { PremiumGate } from "@/components/app/PremiumGate";
import { NotificationBell } from "@/components/app/NotificationBell";

const PREMIUM_ROUTES = new Set(["/app/financeiro", "/app/supervisionandos", "/app/supervisao"]);

const navItems = [
  { to: "/app", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/app/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet, premium: true },
  { to: "/app/supervisionandos", label: "Supervisionandos", icon: GraduationCap, premium: true },
  { to: "/app/supervisao", label: "Supervisão", icon: ShieldCheck, premium: true },
  { to: "/app/biblioteca", label: "Biblioteca", icon: BookOpen },
  { to: "/app/perfil", label: "Perfil", icon: Settings },
];

/* Mobile bottom bar — show first 5 items */
const mobileNavItems = navItems.slice(0, 5);

export const AppLayout = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isPremium } = useSubscription();
  const [planOpen, setPlanOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sessão encerrada.");
    navigate("/auth", { replace: true });
  };

  const handleNavClick = (e: React.MouseEvent, item: typeof navItems[0]) => {
    if (item.premium && !isPremium) {
      e.preventDefault();
      setGateOpen(true);
    }
  };

  // If user navigated directly to a premium route without active sub, show gate
  const showGateOverlay = !isPremium && PREMIUM_ROUTES.has(location.pathname);

  return (
    <div className="min-h-screen bg-gradient-soft flex">
      {/* ── Desktop sidebar (fixed) ── */}
      <aside className="hidden md:flex md:w-64 lg:w-72 fixed inset-y-0 left-0 z-30 bg-card border-r border-border flex-col">
        <div className="p-6 flex items-center justify-between border-b border-border">
          <Link to="/app" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground">
              <Brain className="h-4 w-4" />
            </span>
            <span className="font-display text-xl font-semibold">
              Psi <span className="font-extrabold text-accent">Real</span>
            </span>
          </Link>
          <NotificationBell />
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={(e) => handleNavClick(e, item)}
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
              {item.premium && !isPremium && <Lock className="h-3 w-3 ml-auto opacity-50" />}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={() => setPlanOpen(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-gold hover:bg-gold/10 w-full"
          >
            <Crown className="h-4 w-4" />
            Meu Plano
          </button>
          <p className="text-xs text-muted-foreground truncate mb-3 mt-3">{user?.email}</p>
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
            <span className="font-display text-lg font-semibold">Psi <span className="font-extrabold text-accent">Real</span></span>
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
              onClick={(e) => handleNavClick(e, item)}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 py-2 text-[10px] font-medium transition-colors rounded-lg",
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
          {showGateOverlay ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
                <Lock className="h-10 w-10 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Recurso Exclusivo do Plano Premium</h2>
                <p className="text-muted-foreground max-w-md">
                  Assine o Psi Real Pro para desbloquear esta funcionalidade e organizar sua clínica de forma completa.
                </p>
              </div>
              <p className="text-3xl font-extrabold">
                R$ 39,90<span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <Button variant="accent" size="lg" onClick={() => window.open("https://pay.kiwify.com.br/SEU_LINK_AQUI", "_blank")}>
                <Crown className="h-4 w-4" /> Assinar Agora
              </Button>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>

      <PlanModal open={planOpen} onOpenChange={setPlanOpen} />
      <PremiumGate open={gateOpen} onOpenChange={setGateOpen} />
    </div>
  );
};
