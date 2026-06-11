import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { DSM5Diagnostic, type DSM5Detail, type DSM5HistoryItem } from "./DSM5Diagnostic";

interface Props {
  values: DSM5Detail[];
  onChange: (v: DSM5Detail[]) => void;
  recent?: DSM5HistoryItem[];
}

/**
 * Multi-diagnosis wrapper around DSM5Diagnostic.
 * Supports comorbidades: 1+ diagnoses, the first is marked as "Principal".
 */
export function DSM5MultiDiagnostic({ values, onChange, recent }: Props) {
  const list = values.length === 0 ? [emptyDetail()] : values;

  const updateAt = (i: number, d: DSM5Detail | null) => {
    const next = [...list];
    if (d) next[i] = d;
    else next.splice(i, 1);
    onChange(next.filter(Boolean));
  };

  const setLabelAt = (i: number, label: string) => {
    const next = [...list];
    if (!next[i]) next[i] = emptyDetail();
    next[i] = { ...next[i], diagnosis: label };
    if (!label) next.splice(i, 1);
    onChange(next.length ? next : []);
  };

  const addOne = () => onChange([...list, emptyDetail()]);
  const removeAt = (i: number) => {
    const next = [...list];
    next.splice(i, 1);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {list.map((d, i) => (
        <div key={i} className="rounded-xl border bg-card/40 p-3 sm:p-4 space-y-3 relative">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={i === 0 ? "default" : "secondary"} className="text-[10px]">
              {i === 0 ? "Diagnóstico Principal" : `Comorbidade ${i}`}
            </Badge>
            {(list.length > 1 || (i === 0 && d.diagnosis)) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAt(i)}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" /> Remover
              </Button>
            )}
          </div>
          <DSM5Diagnostic
            value={d.diagnosis}
            onValueChange={(label) => setLabelAt(i, label)}
            detail={d.diagnosis ? d : null}
            onDetailChange={(nd) => updateAt(i, nd)}
            recent={recent}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addOne}
        className="w-full sm:w-auto"
      >
        <Plus className="h-4 w-4" /> Adicionar comorbidade
      </Button>
    </div>
  );
}

function emptyDetail(): DSM5Detail {
  return { diagnosis: "", criteriaChecked: [], severity: "", notes: "" };
}

export default DSM5MultiDiagnostic;
