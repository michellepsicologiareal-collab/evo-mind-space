import { Brain } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground">
            <Brain className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold">
            Psi <span className="font-extrabold text-accent">Real</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} Psi Real · Estrutura para a sua clínica.
        </p>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <a href="#funcionalidades" className="hover:text-foreground">Funcionalidades</a>
          <a href="#cta" className="hover:text-foreground">Começar</a>
        </nav>
      </div>
    </footer>
  );
};
