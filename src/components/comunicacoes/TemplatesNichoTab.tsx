import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NICHOS } from "./ListasTab";

interface Template {
  id: string;
  nicho: string;
  nome: string;
  prompt_ia: string;
  assunto_base: string | null;
  exemplo_email: string | null;
  ativo: boolean;
  created_at: string;
}

interface Props {
  templates: Template[];
  onRefresh: () => void;
}

export function TemplatesNichoTab({ templates, onRefresh }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form
  const [nome, setNome] = useState("");
  const [nicho, setNicho] = useState("");
  const [promptIa, setPromptIa] = useState("");
  const [assuntoBase, setAssuntoBase] = useState("");
  const [exemploEmail, setExemploEmail] = useState("");

  function resetForm() {
    setNome("");
    setNicho("");
    setPromptIa("");
    setAssuntoBase("");
    setExemploEmail("");
    setEditId(null);
  }

  function handleNew() {
    resetForm();
    setDialogOpen(true);
  }

  function handleEdit(t: Template) {
    setEditId(t.id);
    setNome(t.nome);
    setNicho(t.nicho);
    setPromptIa(t.prompt_ia);
    setAssuntoBase(t.assunto_base || "");
    setExemploEmail(t.exemplo_email || "");
    setDialogOpen(true);
  }

  function handleDuplicate(t: Template) {
    resetForm();
    setNome(`${t.nome} (cópia)`);
    setNicho(t.nicho);
    setPromptIa(t.prompt_ia);
    setAssuntoBase(t.assunto_base || "");
    setExemploEmail(t.exemplo_email || "");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!nome || !nicho || !promptIa) {
      toast({ title: "Preencha nome, nicho e prompt", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const payload = {
        user_id: user.id,
        nome,
        nicho,
        prompt_ia: promptIa,
        assunto_base: assuntoBase || null,
        exemplo_email: exemploEmail || null,
      };

      if (editId) {
        const { error } = await supabase.from("email_templates_nicho").update(payload).eq("id", editId);
        if (error) throw error;
        toast({ title: "Template atualizado!" });
      } else {
        const { error } = await supabase.from("email_templates_nicho").insert(payload);
        if (error) throw error;
        toast({ title: "Template criado!" });
      }

      setDialogOpen(false);
      resetForm();
      onRefresh();
    } catch (err: any) {
      toast({ title: "Erro ao salvar template", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("email_templates_nicho").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Template excluído" });
      onRefresh();
    }
  }

  function getNichoLabel(nicho: string) {
    return NICHOS.find(n => n.value === nicho)?.label || nicho;
  }

  // Group by nicho
  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    if (!acc[t.nicho]) acc[t.nicho] = [];
    acc[t.nicho].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Nenhum template de nicho criado.</p>
            <p className="text-xs text-muted-foreground mt-1">Crie templates com prompts personalizados para cada nicho.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([nicho, items]) => (
          <div key={nicho} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{getNichoLabel(nicho)}</Badge>
              <span className="text-xs">{items.length} template{items.length > 1 ? "s" : ""}</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map(t => (
                <Card key={t.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm">{t.nome}</CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDuplicate(t)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-3">{t.prompt_ia}</p>
                    {t.assunto_base && (
                      <p className="text-[10px] text-muted-foreground mt-2 italic">
                        Assunto: {t.assunto_base}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Template" : "Novo Template de Nicho"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Abordagem Inicial - Clínicas" />
              </div>
              <div className="space-y-2">
                <Label>Nicho</Label>
                <Select value={nicho || "none"} onValueChange={(v) => setNicho(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {NICHOS.map(n => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prompt para IA</Label>
              <p className="text-[10px] text-muted-foreground">
                Use {"{{nome}}"}, {"{{empresa}}"}, {"{{cargo}}"}, {"{{email}}"} como variáveis
              </p>
              <Textarea
                value={promptIa}
                onChange={e => setPromptIa(e.target.value)}
                placeholder="Você é um consultor de tecnologia especializado em clínicas médicas. Gere um email de cold outreach personalizado para {{nome}} da empresa {{empresa}}..."
                className="min-h-[160px] font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>Assunto Base (opcional)</Label>
              <Input
                value={assuntoBase}
                onChange={e => setAssuntoBase(e.target.value)}
                placeholder="{{nome}}, sua clínica pode atender 3x mais pacientes com IA"
              />
            </div>

            <div className="space-y-2">
              <Label>Exemplo de Email de Referência (opcional)</Label>
              <Textarea
                value={exemploEmail}
                onChange={e => setExemploEmail(e.target.value)}
                placeholder="Cole aqui um exemplo de email que a IA deve usar como referência..."
                className="min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editId ? "Salvar" : "Criar Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
