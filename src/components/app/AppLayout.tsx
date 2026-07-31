import { useState, useMemo } from "react";
import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { KeepAliveOutlet } from "@/components/app/KeepAliveOutlet";
import logoSrc from "@/assets/logo-psireal.png";
import {
  LayoutDashboard, Users, Calendar, Wallet, Settings, LogOut,
  GraduationCap, ShieldCheck, Crown, Lock, BookOpen, Flower2, FileText,
  FileCheck, Shield, UserCog, Sparkles, ClipboardList, Baby, MoreHorizontal, Target, HeartPulse,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PlanModal } from "@/components/app/PlanModal";
import { PremiumGate } from "@/components/app/PremiumGate";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ThemeToggle } from "@/components/app/ThemeToggle";

const PREMIUM_ROUTES = new Set(["/app/financeiro", "/app/supervisionandos"]);

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  premium?: boolean;
  visibleTo?: Array<"standard" | "supervisee" | "supervisor">;
  hideFromNav?: boolean;
}

/* ── Navigation items for ALL users (including admin as regular user) ──
 *
 * Reorganização de arquitetura: o Paciente é o centro. Registro de Sessão,
 * Plano de Tratamento, Humor e Formulações deixam de ser módulos no menu
 * e passam a ser ações dentro da ficha do paciente. As rotas continuam
 * existindo (para deep-links e navegação interna), apenas saem do menu.
 */
const allNavItems: NavItem[] = [
  { to: "/app", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/app/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet, premium: true },
  { to: "/app/anamneses", label: "Anamneses", icon: Baby },
  { to: "/app/contrato-modelo", label: "Termo de Consentimento", icon: FileText },
  { to: "/app/contratos", label: "Contratos", icon: FileCheck },
  { to: "/app/perfil", label: "Configurações", icon: Settings },

  // Itens que continuam roteáveis, mas ficam fora do menu principal.
  { to: "/app/comece-por-aqui", label: "Comece por Aqui", icon: Sparkles, hideFromNav: true },
  { to: "/app/humor", label: "Humor", icon: HeartPulse, hideFromNav: true },
  { to: "/app/registro-sessao", label: "Registro Sessão", icon: ClipboardList, hideFromNav: true },
  { to: "/app/plano-tratamento", label: "Plano de Tratamento", icon: Target, hideFromNav: true },
  { to: "/app/formulacao-ia", label: "Formulação IA", icon: Sparkles, hideFromNav: true },
  { to: "/app/formulacao-livre", label: "Supervisão IA", icon: GraduationCap, hideFromNav: true },
  { to: "/app/supervisionandos", label: "Supervisionandos", icon: GraduationCap, premium: true, visibleTo: ["supervisor"], hideFromNav: true },
  { to: "/app/biblioteca", label: "Biblioteca", icon: BookOpen, hideFromNav: true },
  { to: "/app/autocuidado", label: "Autocuidado", icon: Flower2, hideFromNav: true },
  
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);


  const navItems = useMemo(() => {
    return allNavItems.filter((item) => {
      if (item.hideFromNav) return false;
      if (!item.visibleTo) return true;
      if (isAdmin) return true;
      return item.visibleTo.includes(profileType);
    });
  }, [profileType, isAdmin]);

  // Mobile: 4 primaries + "Mais" para o restante
  const mobilePrimary = useMemo(() => {
    const keys = ["/app", "/app/pacientes", "/app/agenda", "/app/financeiro"];
    return keys.map((k) => navItems.find((n) => n.to === k)).filter(Boolean) as NavItem[];
  }, [navItems]);
  const mobileSecondaryOrder = [
    "/app/anamneses",
    "/app/contrato-modelo",
    "/app/contratos",
    "/app/perfil",
  ];
  const mobileSecondary = useMemo(
    () => {
      const rest = navItems.filter((n) => !mobilePrimary.includes(n));
      return mobileSecondaryOrder
        .map((r) => rest.find((n) => n.to === r))
        .filter(Boolean)
        .concat(rest.filter((n) => !mobileSecondaryOrder.includes(n.to))) as NavItem[];
    },
    [navItems, mobilePrimary]
  );
  const [moreOpen, setMoreOpen] = useState(false);

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
  const isDynamicPatientFormulation = /^\/app\/pacientes\/[^/]+\/formulacao-(te|act|tcc)$/.test(location.pathname);

  const renderNavLink = (item: NavItem, isAdminSection = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={(e) => handleNavClick(e, item)}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] transition-colors font-sans",
          isActive
            ? isAdminSection
              ? "bg-[hsl(var(--admin-accent))] text-white shadow-soft"
              : "bg-primary text-primary-foreground font-semibold shadow-soft"
            : isAdminSection
            ? "text-[hsl(var(--admin-accent))]/80 hover:bg-[hsl(var(--admin-accent))]/15 hover:text-[hsl(var(--admin-accent))]"
            : "text-[hsl(var(--nav-muted))] hover:bg-white/5 hover:text-[hsl(var(--nav-fg))]"
        )
      }
    >
      <item.icon className="h-4 w-4" />
      {item.label}
      {item.premium && !isPremium && <Lock className="h-3 w-3 ml-auto opacity-50" />}
    </NavLink>
  );

  const sidebarSections: { label: string; routes: string[] }[] = [
    { label: "PRINCIPAL", routes: ["/app", "/app/pacientes", "/app/agenda"] },
    { label: "GESTÃO", routes: ["/app/financeiro", "/app/anamneses", "/app/contrato-modelo", "/app/contratos"] },
    { label: "CONFIGURAÇÕES", routes: ["/app/perfil"] },
  ];

  const renderSidebarInner = (onNavigate?: () => void) => (
    <>
      <nav
        aria-label="Navegação principal"
        className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto"
        onClick={() => onNavigate?.()}
      >
        {sidebarSections.map((sec) => {
          const items = sec.routes
            .map((r) => navItems.find((n) => n.to === r))
            .filter(Boolean) as NavItem[];
          if (items.length === 0) return null;
          return (
            <div key={sec.label} className="space-y-1">
              <div className="px-3.5 pt-5 pb-2 font-display font-semibold text-[9px] uppercase text-[hsl(var(--nav-muted))]/70" style={{ letterSpacing: "0.16em" }}>
                {sec.label}
              </div>
              {items.map((item) => renderNavLink(item))}
            </div>
          );
        })}

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

      <div className="p-3 border-t border-[hsl(var(--nav-border))]">
        <button
          onClick={() => { onNavigate?.(); setPlanOpen(true); }}
          className="flex items-center gap-3 px-3.5 py-3 rounded-xl font-display font-semibold text-sm transition-colors w-full bg-white/5 border border-gold/25 text-[hsl(var(--nav-fg))] hover:bg-white/10"
        >
          <Crown className="h-4 w-4" style={{ color: "hsl(var(--gold))" }} />
          Meu Plano
        </button>
        <p className="text-xs text-[hsl(var(--nav-muted))] truncate mb-3 mt-3 px-1">{user?.email}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start min-h-11 text-[hsl(var(--nav-muted))] hover:bg-white/10 hover:text-[hsl(var(--nav-fg))]"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Linha dourada absoluta no topo da tela */}
      <div className="fixed top-0 inset-x-0 z-50 gold-bar pointer-events-none" />

      {/* ── Desktop sidebar (fixed) ── */}
      <aside className="hidden md:flex md:w-[248px] fixed inset-y-0 left-0 z-30 bg-[hsl(var(--nav-bg))] text-[hsl(var(--nav-fg))] border-r border-[hsl(var(--nav-border))] flex-col">
        <div className="px-5 py-6 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2.5 min-w-0">
            <img src={logoSrc} alt="Psicologia Real" className="h-10 w-10 rounded-xl object-cover flex-shrink-0" />
            <span className="font-display text-lg font-bold tracking-tight leading-tight flex items-center gap-1.5 truncate">
              <span className="text-[hsl(var(--nav-fg))]">Psi</span>
              <span className="text-primary">Real</span>
              <span className="inline-block h-2 w-2 rounded-full bg-gold flex-shrink-0" aria-hidden />
            </span>
          </Link>
          <NotificationBell />
        </div>
        {renderSidebarInner()}
      </aside>

      {/* ── Mobile sidebar (menu recolhível) ── */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="md:hidden w-[280px] p-0 flex flex-col bg-[hsl(var(--nav-bg))] text-[hsl(var(--nav-fg))] border-r border-[hsl(var(--nav-border))]"
        >
          <div className="px-5 py-5 flex items-center gap-2.5">
            <img src={logoSrc} alt="" className="h-9 w-9 rounded-xl object-cover flex-shrink-0" aria-hidden />
            <SheetTitle className="font-display text-lg font-bold tracking-tight flex items-center gap-1.5 text-[hsl(var(--nav-fg))]">
              <span>Psi</span>
              <span className="text-primary">Real</span>
              <span className="inline-block h-2 w-2 rounded-full bg-gold" aria-hidden />
            </SheetTitle>
          </div>
          {renderSidebarInner(() => setSidebarOpen(false))}
        </SheetContent>
      </Sheet>

      {/* ── Mobile top header ── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-card border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Abrir menu de navegação"
              aria-haspopup="dialog"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/app" className="flex items-center gap-2 min-w-0">
              <img src={logoSrc} alt="Psicologia Real" className="h-8 w-8 rounded-full object-cover" />
              <span className="font-display text-lg font-semibold truncate">Psi <span className="font-extrabold text-accent">Real</span></span>
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Sair da conta" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>


      {/* ── Mobile bottom nav (4 primary + Mais) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
        <div className="grid grid-cols-5 py-1.5 px-1">
          {mobilePrimary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={(e) => handleNavClick(e, item)}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 min-h-[52px] py-1.5 text-[10px] leading-tight font-medium transition-colors rounded-lg mx-0.5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive ? "text-primary bg-[rgba(150,117,206,0.10)]" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" aria-hidden />
              <span className="text-center line-clamp-1 px-0.5">{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Abrir mais opções de navegação"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className="flex flex-col items-center justify-center gap-1 min-h-[52px] py-1.5 text-[10px] leading-tight font-medium text-muted-foreground rounded-lg mx-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile "Mais" sheet ── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden rounded-t-3xl max-h-[80vh] overflow-y-auto p-0">
          <div className="p-5">
            <SheetTitle className="font-display text-base font-semibold text-foreground mb-4">
              Mais opções
            </SheetTitle>
            <ul className="grid grid-cols-3 gap-2 list-none p-0 m-0">
              {mobileSecondary.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={(e) => { handleNavClick(e, item); setMoreOpen(false); }}
                    aria-label={item.premium && !isPremium ? `${item.label} (recurso Essencial)` : item.label}
                    className={({ isActive }) =>
                      cn(
                        "flex flex-col items-center justify-center gap-1.5 min-h-[72px] p-2 rounded-xl border text-[11px] font-medium text-center leading-tight",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        isActive
                          ? "bg-[rgba(150,117,206,0.10)] border-primary/30 text-primary-dark"
                          : "bg-muted border-border text-brown"
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" aria-hidden />
                    <span className="line-clamp-2">{item.label}</span>
                    {item.premium && !isPremium && (
                      <Lock className="h-3 w-3 opacity-50" aria-label="Bloqueado" />
                    )}
                  </NavLink>
                </li>
              ))}
              {isAdmin && adminNavItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    aria-label={item.label}
                    className="flex flex-col items-center justify-center gap-1.5 min-h-[72px] p-2 rounded-xl border text-[11px] font-medium text-center leading-tight bg-[hsl(var(--admin-accent))]/10 border-[hsl(var(--admin-accent))]/30 text-[hsl(var(--admin-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--admin-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <item.icon className="h-5 w-5" aria-hidden />
                    <span className="line-clamp-2">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Main content ── */}
      <main className="app-shell flex-1 md:ml-[248px] pt-16 pb-28 md:pt-0 md:pb-0 min-w-0 overflow-x-hidden">
        {/* Top bar desktop (pegada FinPilot) */}
        <div className="hidden md:flex sticky top-0 z-20 items-center justify-between gap-4 border-b border-border bg-background/85 backdrop-blur-lg px-8 xl:px-10 py-3.5">
          <span className="text-sm font-medium text-muted-foreground truncate">
            {allNavItems.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label ?? "PsiReal"}
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="accent" size="sm" onClick={() => setPlanOpen(true)}>
              <Crown className="h-4 w-4" /> Meu Plano
            </Button>
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">

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
          ) : isDynamicPatientFormulation ? (
            <Outlet />
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
