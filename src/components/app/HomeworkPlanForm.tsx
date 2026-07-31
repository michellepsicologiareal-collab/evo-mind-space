import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Plus, Send, CheckSquare, Square, X, NotebookPen, ListChecks, Eye, Target, MessageCircle, Copy, Lock, Shield, ChevronDown, Link2, Info } from "lucide-react";
import { normalizePhoneForWhatsApp } from "@/utils/phoneNormalize";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Estilos compartilhados: campos suaves, labels e ícones finos. */
const FIELD = "border-transparent bg-muted/50 focus-visible:border-primary/40 focus-visible:bg-background";
const LABEL = "flex items-center gap-1.5 text-xs font-medium text-foreground";
const ICON = "h-4 w-4 text-primary";
import {
  actionsSchema,
  normalizeActions,
  serializeActions,
  type ActionItem,
} from "./PatientHomework";

export interface HomeworkPlanFormTask {
  id: string;
  title: string | null;
  content: string;
  session_points: string | null;
  weekly_goal: string | null;
  actions: Json | null;
  weekly_observations: string | null;
  coping_card_title?: string | null;
  coping_card_content?: string | null;
  sent_at: string | null;
  created_at: string;
  session_record_id: string | null;
  session_id?: string | null;
}

export interface SessionRecordOption {
  id: string;
  session_date: string;
  session_number: number | null;
  next_session_plan: string | null;
  clinical_observations: string | null;
}

export interface HomeworkPlanFormProps {
  /** Paciente dono do plano. Obrigatório para novos registros. */
  patientId: string;
  /** Vínculo opcional com a sessão da Agenda (persistido em homework_tasks.session_id). */
  sessionId?: string | null;
  /** Se fornecido, o formulário abre em modo edição desse registro. */
  initialTask?: HomeworkPlanFormTask | null;
  /** Registros de sessão legados para preencher rapidamente (opcional). */
  records?: SessionRecordOption[];
  /** Callback disparado após salvar com sucesso (create ou update). */
  onSaved?: (task: HomeworkPlanFormTask) => void;
  /** Callback opcional para fechar o container pai. */
  onClose?: () => void;
  /** Mostrar seletor legado "preencher a partir de um registro de sessão". Default: true quando não estiver editando. */
  showRecordPicker?: boolean;
  /** Rótulo do botão principal. */
  submitLabel?: string;
  /** Se true, oculta o rodapé (botões e status de autosave) — o parent renderiza seu próprio footer. */
  hideFooter?: boolean;
  /** Dados do paciente para envio por WhatsApp (opcional). */
  patientName?: string | null;
  patientPhone?: string | null;
  homeworkToken?: string | null;
}

/**
 * Formulário reutilizável do "Plano entre Sessões".
 * Mantém o mesmo CRUD em `homework_tasks`, autosave e validações do fluxo original.
 * Aceita `sessionId` para vincular o plano à sessão atual da Agenda.
 */
export const HomeworkPlanForm = ({
  patientId,
  sessionId = null,
  initialTask = null,
  records = [],
  onSaved,
  onClose,
  showRecordPicker,
  submitLabel = "Salvar e fechar",
  hideFooter = false,
  patientName = null,
  patientPhone = null,
  homeworkToken = null,
}: HomeworkPlanFormProps) => {
  const [editing, setEditing] = useState<HomeworkPlanFormTask | null>(initialTask);
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [weeklyGoal, setWeeklyGoal] = useState(initialTask?.weekly_goal ?? "");
  const [sessionPoints, setSessionPoints] = useState(initialTask?.session_points ?? "");
  const [actions, setActions] = useState<ActionItem[]>(normalizeActions(initialTask?.actions ?? null));
  const [actionInput, setActionInput] = useState("");
  const [weeklyObservations, setWeeklyObservations] = useState(initialTask?.weekly_observations ?? "");
  const [copingTitle, setCopingTitle] = useState(initialTask?.coping_card_title ?? "");
  const [copingContent, setCopingContent] = useState(initialTask?.coping_card_content ?? "");
  const [copingOpen, setCopingOpen] = useState<boolean>(Boolean(initialTask?.coping_card_title || initialTask?.coping_card_content));
  const [sourceRecord, setSourceRecord] = useState<string>(initialTask?.session_record_id ?? "none");
  const [saving, setSaving] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);
  const editingRef = useRef<HomeworkPlanFormTask | null>(editing);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  // Reset local state when initialTask changes (parent reused the component with a different record).
  useEffect(() => {
    setEditing(initialTask);
    setTitle(initialTask?.title ?? "");
    setWeeklyGoal(initialTask?.weekly_goal ?? "");
    setSessionPoints(initialTask?.session_points ?? "");
    setActions(normalizeActions(initialTask?.actions ?? null));
    setWeeklyObservations(initialTask?.weekly_observations ?? "");
    setCopingTitle(initialTask?.coping_card_title ?? "");
    setCopingContent(initialTask?.coping_card_content ?? "");
    setCopingOpen(Boolean(initialTask?.coping_card_title || initialTask?.coping_card_content));
    setSourceRecord(initialTask?.session_record_id ?? "none");
    setAutoSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask?.id]);

  const showPicker = showRecordPicker ?? (!editing && records.length > 0);

  const fillFromRecord = (recordId: string) => {
    setSourceRecord(recordId);
    if (recordId === "none") return;
    const rec = records.find((r) => r.id === recordId);
    if (!rec) return;
    if (rec.clinical_observations) setSessionPoints(rec.clinical_observations);
    if (rec.next_session_plan) {
      const lines = rec.next_session_plan.split(/\n|\.\s+/).map((s) => s.trim()).filter(Boolean);
      setActions(lines.map((text) => ({ text, done: false })));
    }
    if (!title) setTitle(`Plano da sessão de ${format(new Date(rec.session_date), "dd/MM/yyyy")}`);
  };

  const addAction = () => {
    const text = actionInput.trim();
    if (!text) return;
    setActions((prev) => [...prev, { text, done: false }]);
    setActionInput("");
  };

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleAction = (index: number) => {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, done: !a.done } : a)));
  };

  const defaultTitle = () => `Plano entre Sessões — ${format(new Date(), "dd/MM/yyyy")}`;

  // Returns true when any user-facing field has content — used as the autosave gate.
  const hasAnyContent = () => (
    title.trim().length > 0 ||
    weeklyGoal.trim().length > 0 ||
    sessionPoints.trim().length > 0 ||
    weeklyObservations.trim().length > 0 ||
    copingTitle.trim().length > 0 ||
    copingContent.trim().length > 0 ||
    actions.some((a) => a.text.trim().length > 0)
  );

  // Autosave (debounced). Triggers on ANY filled field. Title is optional — a neutral
  // default is generated on the first insert when empty.
  useEffect(() => {
    if (!hasAnyContent()) return;
    const handle = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const current = editingRef.current;
      const effectiveTitle = title.trim() || (current?.title ?? defaultTitle());
      const payload: any = {
        title: effectiveTitle,
        content: "",
        weekly_goal: weeklyGoal.trim() || null,
        session_points: sessionPoints.trim() || null,
        actions: serializeActions(actions),
        weekly_observations: weeklyObservations.trim() || null,
        coping_card_title: copingTitle.trim() || null,
        coping_card_content: copingContent.trim() || null,
        session_record_id: sourceRecord === "none" ? null : sourceRecord,
      };
      if (sessionId) payload.session_id = sessionId;
      if (current) {
        const { error } = await supabase.from("homework_tasks").update(payload).eq("id", current.id);
        if (!error) setAutoSavedAt(new Date());
      } else {
        const insertPayload: any = { ...payload, patient_id: patientId, user_id: user.id };
        const { data, error } = await supabase
          .from("homework_tasks")
          .insert(insertPayload)
          .select("*")
          .single();
        if (!error && data) {
          setEditing(data as HomeworkPlanFormTask);
          setAutoSavedAt(new Date());
        }
      }
    }, 1200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, weeklyGoal, sessionPoints, actions, weeklyObservations, copingTitle, copingContent, sourceRecord, sessionId, patientId]);

  const save = async () => {
    if (!hasAnyContent()) { toast.error("Preencha ao menos um campo do plano"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const effectiveTitle = title.trim() || (editing?.title ?? defaultTitle());
    const payload: any = {
      title: effectiveTitle,
      content: "",
      weekly_goal: weeklyGoal.trim() || null,
      session_points: sessionPoints.trim() || null,
      actions: serializeActions(actions),
      weekly_observations: weeklyObservations.trim() || null,
      coping_card_title: copingTitle.trim() || null,
      coping_card_content: copingContent.trim() || null,
      session_record_id: sourceRecord === "none" ? null : sourceRecord,
    };
    if (sessionId) payload.session_id = sessionId;

    let saved: HomeworkPlanFormTask | null = null;
    let err: any = null;
    if (editing) {
      const { data, error } = await supabase
        .from("homework_tasks")
        .update(payload)
        .eq("id", editing.id)
        .select("*")
        .single();
      err = error;
      saved = (data as HomeworkPlanFormTask) ?? null;
    } else {
      const insertPayload: any = { ...payload, patient_id: patientId, user_id: user.id };
      const { data, error } = await supabase
        .from("homework_tasks")
        .insert(insertPayload)
        .select("*")
        .single();
      err = error;
      saved = (data as HomeworkPlanFormTask) ?? null;
    }
    setSaving(false);
    if (err || !saved) { toast.error("Erro ao salvar"); return; }
    toast.success(editing ? "Plano atualizado" : "Plano criado");
    onSaved?.(saved);
    onClose?.();
  };

  const [sending, setSending] = useState(false);
  const [copying, setCopying] = useState(false);
  const [accessPassword, setAccessPassword] = useState<string>("");
  const [loadedPassword, setLoadedPassword] = useState(false);

  // Load existing patient password (so the psi sees what she already set).
  useEffect(() => {
    if (!patientId || loadedPassword) return;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("homework_password")
        .eq("id", patientId)
        .maybeSingle();
      if (data && (data as any).homework_password) {
        setAccessPassword((data as any).homework_password as string);
      }
      setLoadedPassword(true);
    })();
  }, [patientId, loadedPassword]);

  type ShareEvent = { id: string; event_type: string; created_at: string };
  const [shareEvents, setShareEvents] = useState<ShareEvent[]>([]);

  const loadShareEvents = async () => {
    if (!patientId) return;
    const { data } = await (supabase as any)
      .from("homework_share_events")
      .select("id,event_type,created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(20);
    setShareEvents((data as ShareEvent[]) ?? []);
  };

  useEffect(() => { void loadShareEvents(); }, [patientId]);

  const logShare = async (eventType: "link" | "password" | "link_copied" | "password_copied") => {
    if (!patientId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from("homework_share_events").insert({
      user_id: user.id,
      patient_id: patientId,
      task_id: editingRef.current?.id ?? editing?.id ?? null,
      event_type: eventType,
      channel: eventType.endsWith("_copied") ? "copy" : "whatsapp",
    });
    void loadShareEvents();
  };

  const persistPassword = async () => {
    if (!patientId) return;
    const value = accessPassword.trim();
    await supabase
      .from("patients")
      .update({ homework_password: value.length > 0 ? value : null })
      .eq("id", patientId);
  };


  const buildPublicUrl = () => {
    if (!homeworkToken) return null;
    const base = `${window.location.origin}/tarefas/${homeworkToken}`;
    const id = editingRef.current?.id ?? editing?.id;
    return id ? `${base}#plano-${id}` : base;
  };

  const copyPublicLink = async () => {
    const url = buildPublicUrl();
    if (!url) { toast.error("Link público indisponível"); return; }
    setCopying(true);
    try {
      await navigator.clipboard.writeText(url);
      void logShare("link_copied");
      toast.success("Link copiado. Envie a senha separadamente.");

    } catch {
      toast.error("Não foi possível copiar");
    }
    setCopying(false);
  };

  const copyPassword = async () => {
    const pwd = accessPassword.trim();
    if (!pwd) { toast.error("Defina uma senha primeiro"); return; }
    await persistPassword();
    try {
      await navigator.clipboard.writeText(pwd);
      void logShare("password_copied");
      toast.success("Senha copiada");

    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const sendWhatsApp = async () => {
    const digits = normalizePhoneForWhatsApp(patientPhone);
    if (!digits) { toast.error("Paciente sem WhatsApp cadastrado"); return; }
    if (!hasAnyContent()) { toast.error("Preencha ao menos um campo do plano"); return; }
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    await persistPassword();

    // Ensure the plan is persisted before sending (flush current state).
    const effectiveTitle = title.trim() || (editing?.title ?? defaultTitle());
    const payload: any = {
      title: effectiveTitle,
      content: "",
      weekly_goal: weeklyGoal.trim() || null,
      session_points: sessionPoints.trim() || null,
      actions: serializeActions(actions),
      weekly_observations: weeklyObservations.trim() || null,
      coping_card_title: copingTitle.trim() || null,
      coping_card_content: copingContent.trim() || null,
      session_record_id: sourceRecord === "none" ? null : sourceRecord,
      sent_at: new Date().toISOString(),
    };
    if (sessionId) payload.session_id = sessionId;

    let saved: HomeworkPlanFormTask | null = null;
    if (editing) {
      const { data } = await supabase.from("homework_tasks").update(payload).eq("id", editing.id).select("*").single();
      saved = (data as HomeworkPlanFormTask) ?? null;
    } else {
      const { data } = await supabase
        .from("homework_tasks")
        .insert({ ...payload, patient_id: patientId, user_id: user.id })
        .select("*")
        .single();
      saved = (data as HomeworkPlanFormTask) ?? null;
    }
    if (saved) { setEditing(saved); onSaved?.(saved); }

    // Fetch therapist first name for a warmer message.
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const psiName = (profile?.full_name ?? "").trim().split(" ")[0] || "sua psi";
    const firstName = (patientName ?? "").trim().split(" ")[0] || "olá";
    const publicUrl = buildPublicUrl();
    const pwd = accessPassword.trim();

    const parts: string[] = [
      `Olá, ${firstName}! Aqui é a ${psiName}.`,
      "",
      `Preparei seu *Plano entre Sessões*${effectiveTitle ? `: ${effectiveTitle}` : ""}.`,
      "",
    ];
    if (publicUrl) {
      parts.push("Você pode acessar o plano completo (e gerar PDF) pelo link abaixo:");
      parts.push(publicUrl);
      parts.push("");
    }
    if (pwd) {
      parts.push("🔒 O link é protegido por senha. Te envio a senha em uma mensagem separada, por segurança.");
      parts.push("");
    }
    parts.push("Qualquer dúvida, estou por aqui.");

    setSending(false);
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(parts.join("\n"))}`, "_blank");
    void logShare("link");
    toast.success(pwd ? "Plano enviado. Agora envie a senha em uma mensagem separada." : "Plano enviado por WhatsApp");

  };

  const sendPasswordWhatsApp = async () => {
    const digits = normalizePhoneForWhatsApp(patientPhone);
    if (!digits) { toast.error("Paciente sem WhatsApp cadastrado"); return; }
    const pwd = accessPassword.trim();
    if (!pwd) { toast.error("Defina uma senha primeiro"); return; }
    await persistPassword();
    const firstName = (patientName ?? "").trim().split(" ")[0] || "olá";
    const msg = [
      `Oi, ${firstName}! Esta é a *senha* para abrir o seu Plano entre Sessões:`,
      "",
      `🔒 ${pwd}`,
      "",
      "Use-a apenas quando abrir o link que te enviei na mensagem anterior.",
    ].join("\n");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank");
    toast.success("Senha enviada por WhatsApp");
  };

  const canSend = Boolean(patientPhone && normalizePhoneForWhatsApp(patientPhone));
  const canCopy = Boolean(homeworkToken);

  const shareable = Boolean(patientName || patientPhone || homeworkToken);
  const publicUrl = buildPublicUrl();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5 min-w-0">
        <div className="space-y-5 min-w-0 sm:max-h-[60vh] sm:overflow-y-auto sm:pr-1">


          {showPicker && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Preencher a partir de um registro de sessão (opcional)</Label>
              <Select value={sourceRecord} onValueChange={fillFromRecord}>
                <SelectTrigger className="border-transparent bg-muted/50"><SelectValue placeholder="Escolher registro..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Plano livre —</SelectItem>
                  {records.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {format(new Date(r.session_date), "dd/MM/yyyy", { locale: ptBR })}
                      {r.session_number != null && ` · Sessão #${r.session_number}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className={LABEL}>Título do plano <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Semana 3 — Consolidando insights"
              maxLength={200}
              className={FIELD}
            />
          </div>

          <div className="space-y-1.5">
            <Label className={LABEL}>
              <Target className={ICON} /> Objetivo até a próxima sessão
            </Label>
            <Textarea
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Ex: Praticar respiração diafragmática antes das reuniões e registrar sensações após cada uso."
              className={FIELD}
            />
          </div>

          <div className="space-y-1.5">
            <Label className={LABEL}>
              <NotebookPen className={ICON} /> Pontos importantes da sessão
            </Label>
            <Textarea
              value={sessionPoints}
              onChange={(e) => setSessionPoints(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Principais insights, orientações e pontos abordados na sessão..."
              className={FIELD}
            />
          </div>

          <div className="space-y-1.5">
            <Label className={LABEL}>
              <ListChecks className={ICON} /> Ações combinadas
            </Label>
            <div className="relative">
              <Input
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                placeholder="Digite uma ação e pressione Enter..."
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAction(); } }}
                className={`${FIELD} pr-10`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={addAction}
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-primary hover:bg-primary/10"
                title="Adicionar ação"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {actions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {actions.map((a, i) => (
                  <div key={i} className="group flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
                    <button type="button" onClick={() => toggleAction(i)} className="shrink-0">
                      {a.done
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <span className={`flex-1 text-sm ${a.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{a.text}</span>
                    <button
                      type="button"
                      onClick={() => removeAction(i)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      title="Remover"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`rounded-xl border transition-colors ${copingOpen ? "border-lilac/40 bg-lilac/10" : "border-lilac/25 bg-lilac/5"}`}>
            <button
              type="button"
              onClick={() => setCopingOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left"
              aria-expanded={copingOpen}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lilac/20">
                  <Shield className="h-4 w-4 text-lilac" />
                </span>
                Cartão de Enfrentamento
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                {(copingTitle.trim() || copingContent.trim()) && (
                  <span className="rounded-full bg-lilac/20 px-1.5 py-0.5 text-[10px] text-lilac-foreground">preenchido</span>
                )}
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${copingOpen ? "rotate-180" : ""}`} />
            </button>
            {copingOpen && (
              <div className="space-y-3 px-3.5 pb-3.5">
                <p className="text-[11px] text-muted-foreground">
                  Mensagem curta que o paciente poderá consultar em momentos difíceis entre as sessões.
                </p>
                <Input
                  value={copingTitle}
                  onChange={(e) => setCopingTitle(e.target.value)}
                  placeholder="Título — Ex: Quando a ansiedade chegar..."
                  maxLength={200}
                  className="border-transparent bg-background"
                />
                <Textarea
                  value={copingContent}
                  onChange={(e) => setCopingContent(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Ex: Respire fundo 3 vezes. Lembre-se: este sentimento é temporário..."
                  className="border-transparent bg-background"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className={LABEL}>
              <Eye className={ICON} /> O que observar até a próxima sessão
            </Label>
            <Textarea
              value={weeklyObservations}
              onChange={(e) => setWeeklyObservations(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Pensamentos, emoções, comportamentos, gatilhos ou situações relevantes..."
              className={FIELD}
            />
          </div>
        </div>

        {shareable && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Envio para o paciente — em duas mensagens
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 shrink-0 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px] text-xs">
                  Por privacidade, a senha nunca vai na mensagem do plano — envie primeiro o link e depois a senha.
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Passo 1 — link do plano */}
            <div className="space-y-2 rounded-lg border border-border bg-background p-2.5 min-w-0">
              <p className="text-xs font-medium text-foreground">1. Enviar o plano (link)</p>
              <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {publicUrl ?? "Link disponível após salvar"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={copyPublicLink}
                  disabled={copying || !canCopy}
                  title="Copiar link"
                >
                  {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="moss"
                className="w-full sm:w-auto"
                onClick={sendWhatsApp}
                disabled={sending || !canSend}
                title={canSend ? "Enviar plano por WhatsApp" : "Paciente sem WhatsApp cadastrado"}
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                {editing?.sent_at ? "Reenviar plano por WhatsApp" : "Enviar plano por WhatsApp"}
              </Button>
            </div>

            {/* Passo 2 — senha */}
            <div className="space-y-2 rounded-lg border border-border bg-background p-2.5 min-w-0">
              <p className="text-xs font-medium text-foreground">2. Enviar a senha (mensagem separada)</p>
              <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5">
                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  onBlur={() => { void persistPassword(); }}
                  placeholder="Senha salva deste paciente (opcional)"
                  className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
                  maxLength={60}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={copyPassword}
                  disabled={!accessPassword.trim()}
                  title="Copiar senha"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="moss"
                className="w-full sm:w-auto"
                onClick={sendPasswordWhatsApp}
                disabled={!canSend || !accessPassword.trim()}
                title="Enviar senha por WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Enviar senha por WhatsApp
              </Button>
              <p className="text-[11px] text-muted-foreground">
                A senha fica salva neste paciente e vale para todos os planos dele.
              </p>
            </div>
          </div>
        )}


        {!hideFooter && (
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] text-muted-foreground">
              {autoSavedAt
                ? `Salvo automaticamente às ${format(autoSavedAt, "HH:mm:ss")}`
                : hasAnyContent() ? "Salvando automaticamente..." : "Preencha qualquer campo para salvar automaticamente"}
            </span>
            <div className="flex gap-2">
              {onClose && (
                <Button variant="outline" onClick={onClose}>Fechar</Button>
              )}
              <Button variant="accent" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {submitLabel}
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};


// Re-export helpers for callers that already import from this file.
export { actionsSchema, normalizeActions, serializeActions };
export type { ActionItem };
