import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Regressão do menu "..." de ações do paciente.
 *
 * Espelha o padrão usado em `src/pages/app/Patients.tsx` (lista e sheet):
 * - trigger `Button` size="icon" com `aria-label="Ações do paciente"` e `title`
 * - `onKeyDown` que impede propagação de Enter/Espaço (para não disparar o card pai)
 * - `DropdownMenuContent` com `onCloseAutoFocus` mantendo o comportamento padrão do Radix
 * - itens "Compartilhar com supervisor" / "Remover do supervisor"
 *
 * Estas verificações rodam em três larguras de viewport para garantir que
 * o menu funcione em mobile / tablet / desktop.
 */

type Harness = {
  onShare: () => void;
  onUnshare: () => void;
};

function PatientActionsMenu({ onShare, onUnshare }: Harness) {
  return (
    // wrapper com role="button" para reproduzir o card clicável da lista
    <div role="button" tabIndex={0} data-testid="card-paciente">
      <span>Paciente Teste</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Ações do paciente"
            title="Ações do paciente"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={undefined}>
          <DropdownMenuItem onSelect={onShare}>
            Compartilhar com supervisor
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onUnshare}>
            Remover do supervisor
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function setViewport(width: number, height = 800) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
}

const VIEWPORTS: Array<{ name: string; width: number }> = [
  { name: "mobile (375px)", width: 375 },
  { name: "tablet (768px)", width: 768 },
  { name: "desktop (1280px)", width: 1280 },
];

describe("Menu de ações do paciente (regressão multi-viewport)", () => {
  beforeEach(() => {
    setViewport(1280);
  });
  afterEach(() => {
    cleanup();
  });

  for (const vp of VIEWPORTS) {
    describe(`viewport ${vp.name}`, () => {
      beforeEach(() => setViewport(vp.width));

      it("renderiza o trigger com aria-label e title acessíveis", () => {
        render(<PatientActionsMenu onShare={() => {}} onUnshare={() => {}} />);
        const trigger = screen.getByRole("button", { name: "Ações do paciente" });
        expect(trigger).toBeInTheDocument();
        expect(trigger).toHaveAttribute("title", "Ações do paciente");
        // ícone decorativo escondido do leitor de tela
        const icon = trigger.querySelector("svg");
        expect(icon).toHaveAttribute("aria-hidden", "true");
      });

      it("abre o menu ao clicar e mostra as duas opções", async () => {
        const user = userEvent.setup();
        render(<PatientActionsMenu onShare={() => {}} onUnshare={() => {}} />);
        const trigger = screen.getByRole("button", { name: "Ações do paciente" });
        await user.click(trigger);
        expect(
          await screen.findByRole("menuitem", { name: "Compartilhar com supervisor" }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("menuitem", { name: "Remover do supervisor" }),
        ).toBeInTheDocument();
      });

      it("abre via teclado (Enter) sem propagar para o card pai", async () => {
        const user = userEvent.setup();
        let cardClicks = 0;
        render(
          <div
            role="button"
            tabIndex={0}
            onClick={() => cardClicks++}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") cardClicks++;
            }}
          >
            <PatientActionsMenu onShare={() => {}} onUnshare={() => {}} />
          </div>,
        );
        const trigger = screen.getByRole("button", { name: "Ações do paciente" });
        trigger.focus();
        expect(trigger).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(
          await screen.findByRole("menuitem", { name: "Compartilhar com supervisor" }),
        ).toBeInTheDocument();
        expect(cardClicks).toBe(0);
      });

      it("aciona callback ao selecionar item", async () => {
        const user = userEvent.setup();
        let shared = 0;
        render(
          <PatientActionsMenu onShare={() => shared++} onUnshare={() => {}} />,
        );
        await user.click(
          screen.getByRole("button", { name: "Ações do paciente" }),
        );
        await user.click(
          await screen.findByRole("menuitem", {
            name: "Compartilhar com supervisor",
          }),
        );
        expect(shared).toBe(1);
      });

      it("fecha ao pressionar Esc e devolve foco ao trigger", async () => {
        const user = userEvent.setup();
        render(<PatientActionsMenu onShare={() => {}} onUnshare={() => {}} />);
        const trigger = screen.getByRole("button", { name: "Ações do paciente" });
        await user.click(trigger);
        expect(
          await screen.findByRole("menuitem", { name: "Compartilhar com supervisor" }),
        ).toBeInTheDocument();
        await act(async () => {
          await user.keyboard("{Escape}");
        });
        expect(
          screen.queryByRole("menuitem", { name: "Compartilhar com supervisor" }),
        ).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
      });
    });
  }
});
