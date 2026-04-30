import { Brain } from "lucide-react";

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-background/70 border-b border-border/50">
      <div className="container flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2 group">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-soft">
            <Brain className="h-4 w-4" strokeWidth={2.2} />
            <span className="absolute inset-0 rounded-full animate-pulse-ring" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Psi <span className="italic text-accent">Real</span>
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#problema" className="hover:text-foreground transition-colors">Problema</a>
          <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
          <a href="#diferencial" className="hover:text-foreground transition-colors">Diferencial</a>
          <a href="#para-quem" className="hover:text-foreground transition-colors">Para quem</a>
        </nav>
        <a
          href="/auth"
          className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-soft hover:-translate-y-0.5 transition-transform"
        >
          Entrar
        </a>
      </div>
    </header>
  );
};
