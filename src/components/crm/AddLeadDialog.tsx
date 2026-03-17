import { useState, useEffect } from "react";
import { maskPhone, maskMoney, parseMoney } from "@/lib/masks";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCorretores } from "@/hooks/useCorretores";
import { Plus, Loader2, CalendarCheck } from "lucide-react";

const INITIAL = {
  nome: "",
  email: "",
  telefone: "",
  mensagem_original: "",
  tipo_interesse: "",
  tipo_imovel: "",
  valor_minimo: "",
  valor_maximo: "",
  quartos_desejados: "",
  vagas_desejadas: "",
  prazo_decisao: "",
  origem_portal: "manual",
  corretor_id: "",
};

const VISITA_INITIAL = {
  data_visita: "",
  hora_visita: "",
  imovel_id: "__none__",
  tipo: "presencial",
  observacoes: "",
};

export default function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { corretores } = useCorretores();

  // Visit scheduling
  const [agendarVisita, setAgendarVisita] = useState(false);
  const [visitaForm, setVisitaForm] = useState(VISITA_INITIAL);
  const [imoveis, setImoveis] = useState<{ id: string; titulo: string | null; tipo: string; endereco: string | null }[]>([]);

  useEffect(() => {
    if (!agendarVisita || !open) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase
        .from("imoveis")
        .select("id, titulo, tipo, endereco")
        .eq("user_id", session.user.id)
        .eq("status", "disponivel")
        .order("created_at", { ascending: false })
        .limit(200)
        .then(({ data }) => setImoveis((data as any[]) || []));
    });
  }, [agendarVisita, open]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setVisita(field: string, value: string) {
    setVisitaForm((prev) => ({ ...prev, [field]: value }));
  }

  async function pickCorretorRoundRobin(): Promise<string | null> {
    const ativos = corretores.filter((c) => c.ativo);
    if (ativos.length === 0) return null;
    if (ativos.length === 1) return ativos[0].id;

    const ids = ativos.map((c) => c.id);
    const { data: counts } = await supabase
      .from("leads")
      .select("corretor_id")
      .in("corretor_id", ids)
      .not("status", "eq", "perdido");

    const tally: Record<string, number> = {};
    for (const id of ids) tally[id] = 0;
    for (const r of counts || []) {
      if (r.corretor_id) tally[r.corretor_id] = (tally[r.corretor_id] || 0) + 1;
    }

    return ids.reduce((a, b) => (tally[a] <= tally[b] ? a : b));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (agendarVisita && (!visitaForm.data_visita || !visitaForm.hora_visita)) {
      toast({ title: "Preencha data e hora da visita", variant: "destructive" });
      return;
    }

    setSaving(true);

    // Determine initial status
    const initialStatus = agendarVisita ? "visita_agendada" : "novo_lead";

    const payload: Record<string, any> = {
      nome: form.nome.trim(),
      status: initialStatus,
      origem_portal: form.origem_portal || "manual",
    };

    if (form.email.trim()) payload.email = form.email.trim();
    if (form.telefone.trim()) payload.telefone = form.telefone.trim();
    if (form.mensagem_original.trim()) payload.mensagem_original = form.mensagem_original.trim();
    if (form.tipo_interesse) payload.tipo_interesse = form.tipo_interesse;
    if (form.tipo_imovel) payload.tipo_imovel = form.tipo_imovel;
    if (form.valor_minimo) payload.valor_minimo = parseMoney(form.valor_minimo);
    if (form.valor_maximo) payload.valor_maximo = parseMoney(form.valor_maximo);
    if (form.quartos_desejados) payload.quartos_desejados = parseInt(form.quartos_desejados);
    if (form.vagas_desejadas) payload.vagas_desejadas = parseInt(form.vagas_desejadas);
    if (form.prazo_decisao) payload.prazo_decisao = form.prazo_decisao;

    if (form.corretor_id) {
      payload.corretor_id = form.corretor_id;
    } else {
      const autoCorretor = await pickCorretorRoundRobin();
      if (autoCorretor) payload.corretor_id = autoCorretor;
    }

    const { data: newLead, error } = await supabase
      .from("leads")
      .insert(payload as any)
      .select("id")
      .maybeSingle();

    if (error) {
      toast({ title: "Erro ao cadastrar lead", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Create visit if scheduled
    if (agendarVisita && newLead?.id) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error: visitaError } = await supabase.from("agenda_visitas").insert({
          lead_id: newLead.id,
          user_id: session.user.id,
          imovel_id: visitaForm.imovel_id !== "__none__" ? visitaForm.imovel_id : null,
          corretor_id: payload.corretor_id || null,
          data_visita: visitaForm.data_visita,
          hora_visita: visitaForm.hora_visita,
          duracao_minutos: 60,
          tipo: visitaForm.tipo,
          observacoes: visitaForm.observacoes || null,
          status: "agendada",
        } as any);
        if (visitaError) {
          toast({ title: "Lead criado, mas erro na visita", description: visitaError.message, variant: "destructive" });
        }
      }
    }

    toast({ title: agendarVisita ? "Lead criado com visita agendada!" : "Lead cadastrado com sucesso!" });
    setForm(INITIAL);
    setVisitaForm(VISITA_INITIAL);
    setAgendarVisita(false);
    setOpen(false);
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setAgendarVisita(false); setVisitaForm(VISITA_INITIAL); } }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados básicos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="João Silva" />
            </div>
            <div className="space-y-1">
              <Label>Telefone / WhatsApp</Label>
              <Input
                value={form.telefone}
                onChange={(e) => set("telefone", maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="joao@email.com" />
            </div>
          </div>

          {/* Interesse imobiliário */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Interesse Imobiliário
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Interesse</Label>
                <Select value={form.tipo_interesse || "__none__"} onValueChange={(v) => set("tipo_interesse", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {["Compra", "Aluguel", "Investimento", "Temporada"].map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Imóvel</Label>
                <Select value={form.tipo_imovel || "__none__"} onValueChange={(v) => set("tipo_imovel", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {["Apartamento", "Casa", "Terreno", "Sala Comercial", "Galpão", "Cobertura", "Studio"].map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor mínimo (R$)</Label>
                <Input
                  value={form.valor_minimo}
                  onChange={(e) => set("valor_minimo", maskMoney(e.target.value))}
                  placeholder="300.000"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor máximo (R$)</Label>
                <Input
                  value={form.valor_maximo}
                  onChange={(e) => set("valor_maximo", maskMoney(e.target.value))}
                  placeholder="600.000"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quartos desejados</Label>
                <Select value={form.quartos_desejados || "__none__"} onValueChange={(v) => set("quartos_desejados", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qtd." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vagas desejadas</Label>
                <Select value={form.vagas_desejadas || "__none__"} onValueChange={(v) => set("vagas_desejadas", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qtd." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="0">0</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prazo de Decisão</Label>
                <Select value={form.prazo_decisao || "__none__"} onValueChange={(v) => set("prazo_decisao", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Prazo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {["Imediato", "1 a 3 meses", "3 a 6 meses", "Mais de 6 meses"].map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Origem</Label>
                <Select value={form.origem_portal} onValueChange={(v) => set("origem_portal", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">✋ Manual</SelectItem>
                    <SelectItem value="site">🌐 Formulário Site</SelectItem>
                    <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                    <SelectItem value="zap">🏠 ZAP Imóveis</SelectItem>
                    <SelectItem value="vivareal">🏠 Viva Real</SelectItem>
                    <SelectItem value="olx">🏠 OLX</SelectItem>
                    <SelectItem value="meta">📱 Meta Ads</SelectItem>
                    <SelectItem value="indicacao">👤 Indicação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Corretor */}
          {corretores.filter((c) => c.ativo).length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Corretor Responsável</Label>
              <Select value={form.corretor_id || "__auto__"} onValueChange={(v) => set("corretor_id", v === "__auto__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Distribuir automaticamente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Distribuir automaticamente</SelectItem>
                  {corretores.filter((c) => c.ativo).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Mensagem / Contexto</Label>
            <Textarea
              value={form.mensagem_original}
              onChange={(e) => set("mensagem_original", e.target.value)}
              placeholder="Como o lead chegou, o que precisa, observações..."
              rows={2}
            />
          </div>

          {/* Agendar Visita */}
          <div className="border-t pt-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agendarVisita}
                onChange={(e) => setAgendarVisita(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm font-medium flex items-center gap-1.5">
                <CalendarCheck className="h-4 w-4 text-primary" />
                Já tem visita agendada?
              </span>
            </label>

            {agendarVisita && (
              <div className="mt-3 space-y-3 pl-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Data *</Label>
                    <Input
                      type="date"
                      value={visitaForm.data_visita}
                      onChange={(e) => setVisita("data_visita", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Horário *</Label>
                    <Input
                      type="time"
                      value={visitaForm.hora_visita}
                      onChange={(e) => setVisita("hora_visita", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Imóvel</Label>
                  <Select value={visitaForm.imovel_id} onValueChange={(v) => setVisita("imovel_id", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o imóvel..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem imóvel vinculado</SelectItem>
                      {imoveis.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.titulo || i.tipo}{i.endereco ? ` — ${i.endereco}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Visita</Label>
                  <Select value={visitaForm.tipo} onValueChange={(v) => setVisita("tipo", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="online">Online / Vídeo</SelectItem>
                      <SelectItem value="drive-by">Drive-by</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    value={visitaForm.observacoes}
                    onChange={(e) => setVisita("observacoes", e.target.value)}
                    rows={2}
                    placeholder="Detalhes sobre a visita..."
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? "Cadastrando..." : agendarVisita ? "Cadastrar Lead + Agendar Visita" : "Cadastrar Lead"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
