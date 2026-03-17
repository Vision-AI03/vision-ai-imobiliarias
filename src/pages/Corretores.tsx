import { useState } from "react";
import { useCorretores, Corretor } from "@/hooks/useCorretores";
import { maskPhone } from "@/lib/masks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  UserCheck, Plus, Pencil, UserX, Phone, Mail, Award, Target, ExternalLink, Copy, Check,
} from "lucide-react";

const cargoLabels: Record<string, string> = {
  corretor: "Corretor",
  senior: "Corretor Sênior",
  gerente: "Gerente",
  diretor: "Diretor",
};

const perfilColors: Record<string, string> = {
  corretor: "secondary",
  gerente: "default",
  admin: "destructive",
};

function generateSlug(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const emptyForm = {
  nome: "",
  email: "",
  telefone: "",
  whatsapp: "",
  creci: "",
  cargo: "corretor",
  perfil: "corretor",
  especialidade: "ambos",
  meta_leads_mes: "",
  meta_vendas_mes: "",
  meta_alugueis_mes: "",
  texto_apresentacao: "",
};

export default function Corretores() {
  const { corretores, loading, refetch } = useCorretores();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDesativar, setConfirmDesativar] = useState<Corretor | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (c: Corretor) => {
    setForm({
      nome: c.nome,
      email: c.email,
      telefone: c.telefone || "",
      whatsapp: c.whatsapp || "",
      creci: c.creci || "",
      cargo: c.cargo,
      perfil: c.perfil,
      especialidade: c.especialidade || "ambos",
      meta_leads_mes: c.meta_leads_mes?.toString() || "",
      meta_vendas_mes: c.meta_vendas_mes?.toString() || "",
      meta_alugueis_mes: c.meta_alugueis_mes?.toString() || "",
      texto_apresentacao: c.texto_apresentacao || "",
    });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Nome e email são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const slug = generateSlug(form.nome);
      const payload = {
        admin_id: userData.user.id,
        nome: form.nome,
        email: form.email,
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        creci: form.creci || null,
        cargo: form.cargo,
        perfil: form.perfil,
        especialidade: form.especialidade,
        meta_leads_mes: form.meta_leads_mes ? parseInt(form.meta_leads_mes) : null,
        meta_vendas_mes: form.meta_vendas_mes ? parseFloat(form.meta_vendas_mes) : null,
        meta_alugueis_mes: form.meta_alugueis_mes ? parseInt(form.meta_alugueis_mes) : null,
        texto_apresentacao: form.texto_apresentacao || null,
        slug,
      };

      if (editingId) {
        const { error } = await supabase.from("corretores").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Corretor atualizado!");
      } else {
        const { error } = await supabase.from("corretores").insert(payload);
        if (error) throw error;
        toast.success("Corretor cadastrado!");
      }

      setDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar corretor.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAtivo = async (corretor: Corretor) => {
    if (corretor.ativo) {
      setConfirmDesativar(corretor);
    } else {
      await supabase.from("corretores").update({ ativo: true }).eq("id", corretor.id);
      toast.success("Corretor reativado!");
      refetch();
    }
  };

  const handleDesativar = async () => {
    if (!confirmDesativar) return;
    await supabase.from("corretores").update({ ativo: false }).eq("id", confirmDesativar.id);
    toast.success("Corretor desativado. Leads mantidos no sistema.");
    setConfirmDesativar(null);
    refetch();
  };

  const ativos = corretores.filter((c) => c.ativo);
  const inativos = corretores.filter((c) => !c.ativo);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            Corretores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ativos.length} ativo{ativos.length !== 1 ? "s" : ""} · {inativos.length} inativo{inativos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Corretor
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : corretores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <UserCheck className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhum corretor cadastrado</p>
          <p className="text-sm">Clique em "Novo Corretor" para começar.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ativos.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Ativos ({ativos.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ativos.map((c) => (
                  <CorretorCard
                    key={c.id}
                    corretor={c}
                    onEdit={openEdit}
                    onToggleAtivo={handleToggleAtivo}
                  />
                ))}
              </div>
            </div>
          )}
          {inativos.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Inativos ({inativos.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {inativos.map((c) => (
                  <CorretorCard
                    key={c.id}
                    corretor={c}
                    onEdit={openEdit}
                    onToggleAtivo={handleToggleAtivo}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Corretor" : "Novo Corretor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="João da Silva"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="joao@imobiliaria.com.br"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: maskPhone(e.target.value) }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: maskPhone(e.target.value) }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>CRECI</Label>
                <Input
                  value={form.creci}
                  onChange={(e) => setForm((f) => ({ ...f, creci: e.target.value }))}
                  placeholder="12345-F"
                />
              </div>
              <div className="space-y-2">
                <Label>Especialidade</Label>
                <Select
                  value={form.especialidade}
                  onValueChange={(v) => setForm((f) => ({ ...f, especialidade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="locacao">Locação</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select
                  value={form.cargo}
                  onValueChange={(v) => setForm((f) => ({ ...f, cargo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretor">Corretor</SelectItem>
                    <SelectItem value="senior">Corretor Sênior</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="diretor">Diretor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Perfil de Acesso</Label>
                <Select
                  value={form.perfil}
                  onValueChange={(v) => setForm((f) => ({ ...f, perfil: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretor">Corretor</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Apresentação (hotsite)</Label>
              <Input
                value={form.texto_apresentacao}
                onChange={(e) => setForm((f) => ({ ...f, texto_apresentacao: e.target.value }))}
                placeholder="Especialista em imóveis de alto padrão em São Paulo..."
              />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Metas Mensais
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Leads</Label>
                  <Input
                    type="number"
                    value={form.meta_leads_mes}
                    onChange={(e) => setForm((f) => ({ ...f, meta_leads_mes: e.target.value }))}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vendas (R$)</Label>
                  <Input
                    type="number"
                    value={form.meta_vendas_mes}
                    onChange={(e) => setForm((f) => ({ ...f, meta_vendas_mes: e.target.value }))}
                    placeholder="500000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aluguéis</Label>
                  <Input
                    type="number"
                    value={form.meta_alugueis_mes}
                    onChange={(e) => setForm((f) => ({ ...f, meta_alugueis_mes: e.target.value }))}
                    placeholder="5"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação desativar */}
      <AlertDialog
        open={!!confirmDesativar}
        onOpenChange={(o) => !o && setConfirmDesativar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar corretor?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDesativar?.nome} será marcado como inativo. Os leads e contratos vinculados
              permanecerão no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesativar} className="bg-destructive text-white">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CorretorCard({
  corretor,
  onEdit,
  onToggleAtivo,
}: {
  corretor: Corretor;
  onEdit: (c: Corretor) => void;
  onToggleAtivo: (c: Corretor) => void;
}) {
  const [copied, setCopied] = useState(false);
  const hotsiteUrl = corretor.slug ? `${window.location.origin}/c/${corretor.slug}` : null;

  function copyHotsite() {
    if (!hotsiteUrl) return;
    navigator.clipboard.writeText(hotsiteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const initials = corretor.nome
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={corretor.foto_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm leading-tight">{corretor.nome}</p>
              <p className="text-xs text-muted-foreground">
                {cargoLabels[corretor.cargo] || corretor.cargo}
              </p>
              {corretor.creci && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  CRECI {corretor.creci}
                </p>
              )}
            </div>
          </div>
          <Badge variant={perfilColors[corretor.perfil] as any} className="text-xs">
            {corretor.perfil}
          </Badge>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          {corretor.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{corretor.email}</span>
            </div>
          )}
          {corretor.telefone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{corretor.telefone}</span>
            </div>
          )}
        </div>

        {(corretor.meta_leads_mes || corretor.meta_vendas_mes) && (
          <div className="flex gap-3 text-xs">
            {corretor.meta_leads_mes && (
              <span className="bg-muted px-2 py-0.5 rounded">
                Meta: {corretor.meta_leads_mes} leads/mês
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-2">
            <Switch
              checked={corretor.ativo}
              onCheckedChange={() => onToggleAtivo(corretor)}
              className="scale-75"
            />
            <span className="text-xs text-muted-foreground">
              {corretor.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {hotsiteUrl && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Copiar link do hotsite"
                  onClick={copyHotsite}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Abrir hotsite"
                  onClick={() => window.open(hotsiteUrl, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(corretor)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
