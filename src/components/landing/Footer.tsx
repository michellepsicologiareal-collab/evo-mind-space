import { Instagram, MapPin } from "lucide-react";
import logoSrc from "@/assets/logo-psireal.png";

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden">
            <img src={logoSrc} alt="Psicologia Real" className="h-8 w-8 object-cover" />
          </span>

          <span className="font-display text-lg font-semibold">
            Psi <span className="font-extrabold text-accent">Real</span>
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Presencial em Jarinu · Online
          </p>

          <a
            href="https://instagram.com/psimichelledonega"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-accent transition-colors"
          >
            <Instagram className="h-3.5 w-3.5" />
            @psimichelledonega
          </a>
        </div>

        <div className="flex flex-col items-center md:items-end gap-2">
          <nav className="flex gap-6 text-sm text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground">
              Funcionalidades
            </a>

            <a href="#cta" className="hover:text-foreground">
              Começar
            </a>

            <a href="/privacidade.html" className="hover:text-foreground">
              Privacidade
            </a>

            <a href="/termos.html" className="hover:text-foreground">
              Termos
            </a>
          </nav>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Psi Real · Estrutura para a sua clínica.
          </p>
        </div>
      </div>
    </footer>
  );
};
