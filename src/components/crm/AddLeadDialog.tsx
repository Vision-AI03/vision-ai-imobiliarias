import { useState } from "react";
import { maskPhone } from "@/lib/masks";
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
import { Plus, Loader2 } from "lucide-react";

const INITIAL = {
  nome: "",
  email: "",
  telefone: "",
  mensagem_original: "",
  tipo_interesse: "",
  tipo_imovel: "",
  valor_min: "",
  valor_max: "",
  quartos_desejado: "",
  vagas_desejado: "",
  prazo_decisao: "",
  origem_portal: "manual",
  corretor_responsavel: "",
};

export default function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { corretores } = useCorretores();

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function pickCorretorRoundRobin(): Promise<string | null> {
    const ativos = corretores.filter((c) => c.ativo);
    if (ativos.length === 0) return null;
    if (ativos.length === 1) return ativos[0].id;

    // Find which active corretor has the fewest open leads (balanced distribution)
    const ids = ativos.map((c) => c.id);
    const { data: counts } = await supabase
      .from("leads")
      .select("corretor_responsavel")
      .in("corretor_responsavel", ids)
      .not("status", "eq", "perdido");

    const tally: Record<string, number> = {};
    for (const id of ids) tally[id] = 0;
    for (const r of counts || []) {
      if (r.corretor_responsavel) tally[r.corretor_responsavel] = (tally[r.corretor_responsavel] || 0) + 1;
    }

    // Pick the corretor with fewest leads
    return ids.reduce((a, b) => (tally[a] <= tally[b] ? a : b));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload: Record<string, any> = {
      nome: form.nome.trim(),
      status: "novo_lead",
      origem_portal: form.origem_portal || "manual",
    };

    if (form.email.trim()) payload.email = form.email.trim();
    if (form.telefone.trim()) payload.telefone = form.telefone.trim();
    if (form.mensagem_original.trim()) payload.mensagem_original = form.mensagem_original.trim();
    if (form.tipo_interesse) payload.tipo_interesse = form.tipo_interesse;
    if (form.tipo_imovel) payload.tipo_imovel = form.tipo_imovel;
    if (form.valor_min) payload.valor_min = parseFloat(form.valor_min);
    if (form.valor_max) payload.valor_max = parseFloat(form.valor_max);
    if (form.quartos_desejado) payload.quartos_desejado = parseInt(form.quartos_desejado);
    if (form.vagas_desejado) payload.vagas_desejado = parseInt(form.vagas_desejado);
    if (form.prazo_decisao) payload.prazo_decisao = form.prazo_decisao;

    if (form.corretor_responsavel) {
      payload.corretor_responsavel = form.corretor_responsavel;
    } else {
      // Auto round-robin assignment
      const autoCorretor = await pickCorretorRoundRobin();
      if (autoCorretor) payload.corretor_responsavel = autoCorretor;
    }

    const { error } = await supabase.from("leads").insert(payload as any);

    if (error) {
      toast({ title: "Erro ao cadastrar lead", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead cadastrado com sucesso!" });
      setForm(INITIAL);
      setOpen(false);
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              <Input value={form.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
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
                <Select value={form.tipo_interesse} onValueChange={(v) => set("tipo_interesse", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {["Compra", "Aluguel", "Investimento", "Temporada"].map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Imóvel</Label>
                <Select value={form.tipo_imovel} onValueChange={(v) => set("tipo_imovel", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {["Apartamento", "Casa", "Terreno", "Sala Comercial", "Galpão", "Cobertura", "Studio"].map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor mínimo (R$)</Label>
                <Input
                  type="number"
                  value={form.valor_min}
                  onChange={(e) => set("valor_min", e.target.value)}
                  placeholder="300000"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor máximo (R$)</Label>
                <Input
                  type="number"
                  value={form.valor_max}
                  onChange={(e) => set("valor_max", e.target.value)}
                  placeholder="600000"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quartos desejados</Label>
                <Select value={form.quartos_desejado} onValueChange={(v) => set("quartos_desejado", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qtd." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vagas desejadas</Label>
                <Select value={form.vagas_desejado} onValueChange={(v) => set("vagas_desejado", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qtd." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prazo de Decisão</Label>
                <Select value={form.prazo_decisao} onValueChange={(v) => set("prazo_decisao", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Prazo..." /></SelectTrigger>
                  <SelectContent>
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
              <Select value={form.corretor_responsavel || "__auto__"} onValueChange={(v) => set("corretor_responsavel", v === "__auto__" ? "" : v)}>
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
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? "Cadastrando..." : "Cadastrar Lead"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
