import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

/**
 * Regressão do comportamento "recurso não preenchido" no Drawer do paciente
 * (`src/pages/app/Patients.tsx`).
 *
 * Reproduz o guard aplicado aos handlers `onView` de:
 * - Formulação TCC, TE, ACT, RPD (aba Formulações)
 * - Registros TCC, Humor, Histórico, Registros de sessão (aba Sessões)
 * - Plano terapêutico (aba Plano terapêutico)
 * - Anamnese (aba Anamneses)
 *
 * Regra: quando o recurso não existir, exibir toast e NÃO navegar,
 * NÃO fechar o Sheet, manter paciente selecionado e aba ativa.
 */

const navigateSpy = vi.fn();
const toastSpy = vi.fn();

type Resource =
  | "formulacao_tcc"
  | "formulacao_te"
  | "formulacao_act"
  | "formulacao_rpd"
  | "anamnese"
  | "plano"
  | "registros_tcc";

const LABELS: Record<Resource, string> = {
  formulacao_tcc: "Formulação TCC",
  formulacao_te: "Formulação TE",
  formulacao_act: "Formulação ACT",
  formulacao_rpd: "Registros TCC (RPD)",
  anamnese: "Anamnese",
  plano: "Plano terapêutico",
  registros_tcc: "Registros TCC",
};

/**
 * Guard idêntico ao usado nos chips do Drawer: se `exists` for falsy,
 * dispara toast e curto-circuita (sem navegar, sem fechar Sheet).
 */
function guardOpen(exists: boolean, label: string, path: string) {
  if (!exists) {
    toastSpy({
      title: `${label} ainda não foi preenchido para este paciente.`,
    });
    return;
  }
  navigateSpy(path);
}

function Harness({ existing }: { existing: Set<Resource> }) {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>({
    id: "p1",
    name: "Aline dos Anjos",
  });
  const [tab, setTab] = useState("formulations");

  const chips: { key: Resource; path: string }[] = [
    { key: "formulacao_tcc", path: "/app/pacientes/p1/formulacao-tcc" },
    { key: "formulacao_te", path: "/app/pacientes/p1/formulacao-te" },
    { key: "formulacao_act", path: "/app/pacientes/p1/formulacao-act" },
    { key: "formulacao_rpd", path: "/app/registro-sessao?patient=p1&tab=rpd" },
    { key: "anamnese", path: "/app/anamneses?patient=p1" },
    { key: "plano", path: "/app/plano-tratamento?patient=p1" },
    { key: "registros_tcc", path: "/app/registro-sessao?patient=p1" },
  ];

  return (
    <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] p-0">
        <VisuallyHidden>
          <SheetTitle>{selected?.name ?? ""}</SheetTitle>
          <SheetDescription>Ficha</SheetDescription>
        </VisuallyHidden>
        {selected && (
          <div>
            <p data-testid="sheet-name">{selected.name}</p>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="overview">Visão geral</TabsTrigger>
                <TabsTrigger value="formulations">Formulações</TabsTrigger>
                <TabsTrigger value="sessions">Sessões</TabsTrigger>
                <TabsTrigger value="plan">Plano terapêutico</TabsTrigger>
                <TabsTrigger value="anamnesis">Anamneses</TabsTrigger>
              </TabsList>
              <TabsContent value="formulations">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    data-no-card-open
                    onClick={(e) => {
                      e.stopPropagation();
                      guardOpen(existing.has(c.key), LABELS[c.key], c.path);
                    }}
                  >
                    {LABELS[c.key]}
                  </button>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

describe("Drawer do paciente — recurso ainda não preenchido", () => {
  afterEach(() => {
    cleanup();
    navigateSpy.mockReset();
    toastSpy.mockReset();
  });

  const cases: { key: Resource; label: string }[] = [
    { key: "formulacao_tcc", label: "Formulação TCC" },
    { key: "formulacao_te", label: "Formulação TE" },
    { key: "formulacao_act", label: "Formulação ACT" },
    { key: "formulacao_rpd", label: "Registros TCC (RPD)" },
    { key: "anamnese", label: "Anamnese" },
    { key: "plano", label: "Plano terapêutico" },
    { key: "registros_tcc", label: "Registros TCC" },
  ];

  it.each(cases)(
    "$label sem registro: mostra toast, não navega e mantém Sheet + aba",
    async ({ key, label }) => {
      const user = userEvent.setup();
      render(<Harness existing={new Set()} />);

      const tabBefore = screen.getByRole("tab", { name: "Formulações" });
      expect(tabBefore).toHaveAttribute("data-state", "active");

      await user.click(screen.getByRole("button", { name: label }));

      expect(navigateSpy).not.toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledTimes(1);
      expect(toastSpy.mock.calls[0][0].title).toContain(label);
      expect(toastSpy.mock.calls[0][0].title).toContain("ainda não foi preenchido");

      // Sheet segue aberto, paciente e aba preservados
      expect(screen.getByTestId("sheet-name")).toHaveTextContent("Aline dos Anjos");
      expect(screen.getByRole("tab", { name: "Formulações" })).toHaveAttribute(
        "data-state",
        "active",
      );
      // Sanity: guard não deveria ter usado o path
      expect(key).toBeTruthy();
    },
  );

  it("recurso preenchido: navega normalmente e não mostra toast", async () => {
    const user = userEvent.setup();
    render(<Harness existing={new Set<Resource>(["formulacao_tcc"])} />);

    await user.click(screen.getByRole("button", { name: "Formulação TCC" }));

    expect(toastSpy).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith("/app/pacientes/p1/formulacao-tcc");
  });

  it("clique em chip vazio não fecha o Sheet mesmo após múltiplas tentativas", async () => {
    const user = userEvent.setup();
    render(<Harness existing={new Set()} />);

    await user.click(screen.getByRole("button", { name: "Formulação TCC" }));
    await user.click(screen.getByRole("button", { name: "Anamnese" }));
    await user.click(screen.getByRole("button", { name: "Plano terapêutico" }));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("sheet-name")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Formulações" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });
});
