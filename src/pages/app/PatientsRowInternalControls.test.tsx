import { describe, it, expect, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

/**
 * Regressão: controles internos da linha do paciente NUNCA devem abrir o Sheet.
 *
 * Cobre:
 * - Badge clicável (status/pagamento) com role="button"
 * - Botão inline (ex.: "Marcar como pago") dentro da linha
 * - Link (<a>) interno
 * - Input dentro da linha
 * - Trigger do menu "..." e cada DropdownMenuItem
 * - Elementos marcados com data-no-card-open
 */

type Patient = { id: string; full_name: string };
const PATIENT: Patient = { id: "p1", full_name: "Aline dos Anjos" };

function Harness({ onAction }: { onAction: (name: string) => void }) {
  const [selected, setSelected] = useState<Patient | null>(null);

  const openRow = (p: Patient) => (e: React.MouseEvent | React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const interactive = target.closest(
      'button, a, input, textarea, select, [role="menu"], [role="menuitem"], [data-no-card-open]'
    );
    if (interactive && interactive !== e.currentTarget) return;
    setSelected(p);
  };

  return (
    <>
      <table>
        <tbody>
          <tr
            role="button"
            tabIndex={0}
            aria-label={`Abrir ficha de ${PATIENT.full_name}`}
            onClick={openRow(PATIENT)}
          >
            <td>
              <p data-testid="name">{PATIENT.full_name}</p>
            </td>
            <td>
              <Badge
                role="button"
                tabIndex={0}
                aria-label="Filtrar por status ativo"
                data-testid="badge-status"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction("badge");
                }}
              >
                Ativo
              </Badge>
            </td>
            <td>
              <button
                type="button"
                data-testid="btn-pay"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction("pay");
                }}
              >
                Marcar como pago
              </button>
            </td>
            <td>
              <a
                href="#"
                data-testid="link-detail"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAction("link");
                }}
              >
                ver detalhe
              </a>
            </td>
            <td>
              <input
                data-testid="input-note"
                aria-label="anotação"
                onClick={(e) => e.stopPropagation()}
              />
            </td>
            <td>
              <span
                data-testid="no-card-open"
                data-no-card-open
                onClick={(e) => {
                  e.stopPropagation();
                  onAction("no-card-open");
                }}
              >
                chip
              </span>
            </td>
            <td>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Ações de ${PATIENT.full_name}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      onAction("menu-edit");
                    }}
                  >
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      onAction("menu-archive");
                    }}
                  >
                    Arquivar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        </tbody>
      </table>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[640px] p-0">
          <VisuallyHidden>
            <SheetTitle>Ficha</SheetTitle>
            <SheetDescription>Ficha clínica do paciente</SheetDescription>
          </VisuallyHidden>
          {selected && <p data-testid="sheet-name">{selected.full_name}</p>}
        </SheetContent>
      </Sheet>
    </>
  );
}

describe("Controles internos da linha NÃO abrem o Sheet", () => {
  afterEach(() => cleanup());

  it("clicar em badge não abre o Sheet", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    await user.click(screen.getByTestId("badge-status"));
    expect(onAction).toHaveBeenCalledWith("badge");
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();
  });

  it("clicar em botão inline não abre o Sheet", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    await user.click(screen.getByTestId("btn-pay"));
    expect(onAction).toHaveBeenCalledWith("pay");
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();
  });

  it("clicar em link interno não abre o Sheet", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    await user.click(screen.getByTestId("link-detail"));
    expect(onAction).toHaveBeenCalledWith("link");
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();
  });

  it("clicar/digitar em input não abre o Sheet", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    const input = screen.getByTestId("input-note");
    await user.click(input);
    await user.type(input, "abc");
    expect(input).toHaveValue("abc");
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();
  });

  it("clicar em elemento data-no-card-open não abre o Sheet", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    await user.click(screen.getByTestId("no-card-open"));
    expect(onAction).toHaveBeenCalledWith("no-card-open");
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();
  });

  it("clicar no trigger '...' não abre o Sheet", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    await user.click(
      screen.getByRole("button", { name: "Ações de Aline dos Anjos" })
    );
    expect(
      await screen.findByRole("menuitem", { name: "Editar" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();
  });

  it("clicar em itens do menu '...' não abre o Sheet", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    await user.click(
      screen.getByRole("button", { name: "Ações de Aline dos Anjos" })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Editar" }));
    expect(onAction).toHaveBeenCalledWith("menu-edit");
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Ações de Aline dos Anjos" })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Arquivar" }));
    expect(onAction).toHaveBeenCalledWith("menu-archive");
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();
  });

  it("controle de sanidade: clicar no nome ABRE o Sheet", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    await user.click(screen.getByTestId("name"));
    expect(await screen.findByTestId("sheet-name")).toHaveTextContent(
      "Aline dos Anjos"
    );
  });
});
