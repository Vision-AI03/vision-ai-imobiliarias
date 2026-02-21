import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";

const INITIAL = {
  nome: "",
  email: "",
  telefone: "",
  empresa: "",
  site_empresa: "",
  linkedin_url: "",
  instagram_url: "",
  mensagem_original: "",
};

export default function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) {
      toast({ title: "Nome e email são obrigatórios", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload: Record<string, string> = {
      nome: form.nome.trim(),
      email: form.email.trim(),
    };
    if (form.telefone.trim()) payload.telefone = form.telefone.trim();
    if (form.empresa.trim()) payload.empresa = form.empresa.trim();
    if (form.site_empresa.trim()) payload.site_empresa = form.site_empresa.trim();
    if (form.linkedin_url.trim()) payload.linkedin_url = form.linkedin_url.trim();
    if (form.instagram_url.trim()) payload.instagram_url = form.instagram_url.trim();
    if (form.mensagem_original.trim()) payload.mensagem_original = form.mensagem_original.trim();

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="João Silva" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="joao@empresa.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="empresa">Empresa</Label>
              <Input id="empresa" value={form.empresa} onChange={(e) => set("empresa", e.target.value)} placeholder="Empresa LTDA" />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="site_empresa">Site da Empresa</Label>
            <Input id="site_empresa" value={form.site_empresa} onChange={(e) => set("site_empresa", e.target.value)} placeholder="https://empresa.com.br" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="linkedin_url">LinkedIn</Label>
              <Input id="linkedin_url" value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="linkedin.com/in/joao" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="instagram_url">Instagram</Label>
              <Input id="instagram_url" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} placeholder="@empresa" />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="mensagem">Mensagem / Contexto</Label>
            <Textarea id="mensagem" value={form.mensagem_original} onChange={(e) => set("mensagem_original", e.target.value)} placeholder="Como o lead chegou, o que precisa..." rows={3} />
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
