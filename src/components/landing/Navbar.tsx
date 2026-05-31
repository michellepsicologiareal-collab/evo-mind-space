import { MessageCircle } from "lucide-react";
import logoSrc from "@/assets/logo-psireal.svg";

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-background/70 border-b border-border/50">
      <div className="container flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2 group">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full overflow-hidden shadow-soft">
            <img src={logoSrc} alt="Psicologia Real" className="h-9 w-9 object-cover" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Psi <span className="font-extrabold text-accent">Real</span>
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
          <a href="#supervisao" className="hover:text-foreground transition-colors">Supervisão</a>
          <a href="#confianca" className="hover:text-foreground transition-colors">Segurança</a>
          <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          <a
            href="https://wa.me/5511947388423?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20Psi%20Real"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-accent hover:text-accent/80 transition-colors font-medium"
          >
            <MessageCircle className="h-4 w-4" />
            Suporte
          </a>
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
