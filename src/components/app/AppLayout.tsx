import { useState, useMemo } from "react";
import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { KeepAliveOutlet } from "@/components/app/KeepAliveOutlet";
import logoSrc from "@/assets/logo-psireal.png";
import {
  LayoutDashboard, Users, Calendar, Wallet, Settings, LogOut,
  GraduationCap, ShieldCheck, Crown, Lock, BookOpen, Flower2, FileText,
  FileCheck, Shield, UserCog, Sparkles, ClipboardList, Baby,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PlanModal } from "@/components/app/PlanModal";
import { PremiumGate } from "@/components/app/PremiumGate";
import { NotificationBell } from "@/components/app/NotificationBell";

const PREMIUM_ROUTES = new Set(["/app/financeiro", "/app/supervisionandos"]);

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  premium?: boolean;
  visibleTo?: Array<"standard" | "supervisee" | "supervisor">;
}

/* ── Navigation items for ALL users (including admin as regular user) ── */
const allNavItems: NavItem[] = [
  { to: "/app/comece-por-aqui", label: "Comece por Aqui", icon: Sparkles },
  { to: "/app", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/app/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/registro-sessao", label: "Registro Sessão", icon: ClipboardList },
  { to: "/app/anamneses", label: "Anamneses", icon: Baby },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet, premium: true },
  { to: "/app/supervisionandos", label: "Supervisionandos", icon: GraduationCap, premium: true, visibleTo: ["supervisor"] },
  { to: "/app/biblioteca", label: "Biblioteca", icon: BookOpen },
  { to: "/app/autocuidado", label: "Autocuidado", icon: Flower2 },
  { to: "/app/contrato-modelo", label: "Termo", icon: FileText },
  { to: "/app/contratos", label: "Contratos", icon: FileCheck },
  { to: "/app/perfil", label: "Perfil", icon: Settings },
];

/* ── Admin-only items (shown in a separate section) ── */
const adminNavItems: NavItem[] = [
  { to: "/admin", label: "Painel Admin", icon: Shield },
];

export const AppLayout = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isPremium, profileType, isAdmin } = useSubscription();
  const [planOpen, setPlanOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  const navItems = useMemo(() => {
    return allNavItems.filter((item) => {
      if (!item.visibleTo) return true;
      if (isAdmin) return true;
      return item.visibleTo.includes(profileType);
    });
  }, [profileType, isAdmin]);

  // Mobile: show key items in bottom bar, rest accessible via "Mais" or scrollable
  const mobileNavItems = navItems;

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sessão encerrada.");
    navigate("/auth", { replace: true });
  };

  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    if (item.premium && !isPremium) {
      e.preventDefault();
      setGateOpen(true);
    }
  };

  const showGateOverlay = !isPremium && PREMIUM_ROUTES.has(location.pathname);

  const renderNavLink = (item: NavItem, isAdminSection = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={(e) => handleNavClick(e, item)}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-4 py-2.5 text-[12px] transition-colors font-sans",
          isActive
            ? isAdminSection
              ? "bg-[hsl(var(--admin-accent))] text-white shadow-soft rounded-xl"
              : "bg-[rgba(109,79,194,0.08)] text-[#3d2b8a] font-medium border-l-[3px] border-l-[#6d4fc2] rounded-none"
            : isAdminSection
            ? "text-[hsl(var(--admin-accent))]/80 hover:bg-[hsl(var(--admin-accent))]/10 hover:text-[hsl(var(--admin-accent))] rounded-xl"
            : "text-[#8878b0] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[#3d2b8a] rounded-xl"
        )
      }
    >
      <item.icon className="h-4 w-4" />
      {item.label}
      {item.premium && !isPremium && <Lock className="h-3 w-3 ml-auto opacity-50" />}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Linha dourada absoluta no topo da tela */}
      <div className="fixed top-0 inset-x-0 z-50 gold-bar pointer-events-none" />

      {/* ── Desktop sidebar (fixed) ── */}
      <aside className="hidden md:flex md:w-[220px] fixed inset-y-0 left-0 z-30 bg-[#faf8ff] border-r border-[#ede9f8] flex-col">
        <div className="p-6 flex items-center justify-between border-b border-[#ede9f8]">
          <Link to="/app" className="flex items-center gap-2">
            <img src={logoSrc} alt="Psicologia Real" className="h-9 w-9 rounded-full object-cover" />
            <span className="font-display text-xl font-bold tracking-tight flex items-center gap-1.5">
              <span className="text-[#1a1030]">Psi</span>
              <span className="text-[#6d4fc2]">Real</span>
              <span className="inline-block h-2 w-2 rounded-full bg-[#c9a84c]" aria-hidden />
            </span>
          </Link>
          <NotificationBell />
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {(() => {
            const sections: { label: string; routes: string[] }[] = [
              { label: "INÍCIO", routes: ["/app/comece-por-aqui", "/app"] },
              { label: "CLÍNICA", routes: ["/app/pacientes", "/app/agenda", "/app/registro-sessao", "/app/anamneses", "/app/financeiro", "/app/supervisionandos"] },
              { label: "RECURSOS", routes: ["/app/biblioteca", "/app/autocuidado", "/app/contrato-modelo", "/app/contratos", "/app/perfil"] },
            ];
            return sections.map((sec) => {
              const items = sec.routes
                .map((r) => navItems.find((n) => n.to === r))
                .filter(Boolean) as NavItem[];
              if (items.length === 0) return null;
              return (
                <div key={sec.label} className="space-y-1">
                  <div className="px-4 pt-4 pb-1.5 font-display font-semibold text-[9px] uppercase text-[#a090c8]" style={{ letterSpacing: "0.14em" }}>
                    {sec.label}
                  </div>
                  {items.map((item) => renderNavLink(item))}
                </div>
              );
            });
          })()}

          {/* ── Admin section (visually separated, different color) ── */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <div className="flex items-center gap-2 px-4">
                  <div className="h-px flex-1 bg-[hsl(var(--admin-accent))]/20" />
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-[hsl(var(--admin-accent))]/60">
                    Administração
                  </span>
                  <div className="h-px flex-1 bg-[hsl(var(--admin-accent))]/20" />
                </div>
              </div>
              <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-[hsl(var(--admin-accent))]/10 px-3 py-2 border border-[hsl(var(--admin-accent))]/20">
                <ShieldCheck className="h-4 w-4 text-[hsl(var(--admin-accent))]" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-[hsl(var(--admin-accent))]">Admin Master</span>
                  <span className="text-[10px] text-[hsl(var(--admin-accent))]/60">Permissão verificada ✓</span>
                </div>
              </div>
              {adminNavItems.map((item) => renderNavLink(item, true))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[#ede9f8]">
          <button
            onClick={() => setPlanOpen(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-[10px] font-display font-semibold text-sm transition-colors w-full"
            style={{
              background: "rgba(201,168,76,0.08)",
              border: "0.5px solid rgba(201,168,76,0.25)",
              color: "#7a5e1a",
            }}
          >
            <Crown className="h-4 w-4" style={{ color: "#c9a84c" }} />
            Meu Plano
          </button>
          <p className="text-xs text-muted-foreground truncate mb-3 mt-3">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* ── Mobile top header ── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-card border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/app" className="flex items-center gap-2">
            <img src={logoSrc} alt="Psicologia Real" className="h-8 w-8 rounded-full object-cover" />
            <span className="font-display text-lg font-semibold">Psi <span className="font-extrabold text-accent">Real</span></span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="text-[hsl(var(--admin-accent))]">
                <Shield className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
        <div className="grid grid-cols-5 xs:grid-cols-6 py-1 px-1">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={(e) => handleNavClick(e, item)}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 min-h-[40px] py-1.5 text-[9px] leading-tight font-medium transition-colors rounded-lg",
                  isActive ? "text-accent bg-accent/10" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="text-center line-clamp-1 px-0.5">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-[220px] pt-16 pb-28 md:pt-0 md:pb-0">
        <div className="p-6 lg:p-10 max-w-6xl mx-auto">
          {showGateOverlay ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
                <Lock className="h-10 w-10 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Recurso Exclusivo do Essencial PsiReal</h2>
                <p className="text-muted-foreground max-w-md">
                  Assine o Essencial PsiReal para desbloquear esta funcionalidade e organizar sua clínica de forma completa.
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
            <KeepAliveOutlet />
          )}
        </div>
      </main>

      <PlanModal open={planOpen} onOpenChange={setPlanOpen} />
      <PremiumGate open={gateOpen} onOpenChange={setGateOpen} />
    </div>
  );
};
