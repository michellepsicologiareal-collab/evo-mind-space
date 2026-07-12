import { describe, it, expect, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

/**
 * Regressão do clique da linha de paciente em `src/pages/app/Patients.tsx`.
 *
 * Reproduz literalmente:
 * - `<tr role="button" tabIndex={0} onClick={openRow}>` com o guard `openRow`
 *   que ignora elementos interativos internos (button/a/input/menu/menuitem/
 *   data-no-card-open) MAS não a própria linha.
 * - Sheet lateral com Tabs padrão `overview` (Visão geral).
 * - Menu "..." como `<button>` que abre o Radix DropdownMenu e NÃO abre o Sheet.
 */

type Patient = { id: string; full_name: string };

const PATIENTS: Patient[] = [
  { id: "p1", full_name: "Aline dos Anjos" },
  { id: "p2", full_name: "Bruno Ribeiro" },
];

function Harness() {
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
          {PATIENTS.map((p) => (
            <tr
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`Abrir ficha de ${p.full_name}`}
              onClick={openRow(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openRow(p)(e);
                }
              }}
            >
              <td>
                <div data-testid={`avatar-${p.id}`}>
                  {p.full_name.charAt(0)}
                </div>
              </td>
              <td>
                <p data-testid={`name-${p.id}`}>{p.full_name}</p>
              </td>
              <td data-testid={`free-${p.id}`}>&nbsp;</td>
              <td>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Ações de ${p.full_name}`}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                      }}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Editar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[640px] p-0">
          <VisuallyHidden>
            <SheetTitle>{selected?.full_name ?? "Ficha do paciente"}</SheetTitle>
            <SheetDescription>Ficha clínica do paciente</SheetDescription>
          </VisuallyHidden>
          {selected && (
            <div>
              <p data-testid="sheet-name">{selected.full_name}</p>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Visão geral</TabsTrigger>
                  <TabsTrigger value="formulations">Formulações</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <p data-testid="tab-overview-content">Conteúdo Visão geral</p>
                </TabsContent>
                <TabsContent value="formulations">
                  <p>Conteúdo Formulações</p>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

describe("Clique na linha do paciente abre o Sheet", () => {
  afterEach(() => cleanup());

  it("clicar no nome abre o Sheet do paciente correto na aba Visão geral", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("name-p1"));
    expect(await screen.findByTestId("sheet-name")).toHaveTextContent(
      "Aline dos Anjos"
    );
    const tab = screen.getByRole("tab", { name: "Visão geral" });
    expect(tab).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("tab-overview-content")).toBeInTheDocument();
  });

  it("clicar no avatar abre o Sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("avatar-p1"));
    expect(await screen.findByTestId("sheet-name")).toHaveTextContent(
      "Aline dos Anjos"
    );
  });

  it("clicar na área livre da linha abre o Sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("free-p1"));
    expect(await screen.findByTestId("sheet-name")).toHaveTextContent(
      "Aline dos Anjos"
    );
  });

  it("clicar em outro paciente troca imediatamente o Sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("name-p1"));
    expect(await screen.findByTestId("sheet-name")).toHaveTextContent(
      "Aline dos Anjos"
    );
    await user.click(screen.getByTestId("name-p2"));
    expect(await screen.findByTestId("sheet-name")).toHaveTextContent(
      "Bruno Ribeiro"
    );
  });

  it("Enter na linha focada abre o Sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const row = screen.getByRole("button", {
      name: "Abrir ficha de Aline dos Anjos",
    });
    row.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByTestId("sheet-name")).toHaveTextContent(
      "Aline dos Anjos"
    );
  });

  it("clicar no menu '...' NÃO abre o Sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: "Ações de Aline dos Anjos" })
    );
    // menu abriu
    expect(
      await screen.findByRole("menuitem", { name: "Editar" })
    ).toBeInTheDocument();
    // sheet NÃO abriu
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();
  });

  it("Esc fecha o Sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("name-p1"));
    expect(await screen.findByTestId("sheet-name")).toBeInTheDocument();
    await act(async () => {
      await user.keyboard("{Escape}");
    });
    expect(screen.queryByTestId("sheet-name")).not.toBeInTheDocument();
  });
});
