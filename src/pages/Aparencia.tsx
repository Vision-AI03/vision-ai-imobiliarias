import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Save, Palette, Building2, Phone, Mail } from "lucide-react";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { maskCNPJ, maskPhone } from "@/lib/masks";

export default function Aparencia() {
  const { config, loading, refetch, updateConfig } = usePlataforma();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nome_plataforma: "",
    logo_url: "",
    cor_primaria: "#6366f1",
    cor_secundaria: "#8b5cf6",
    nome_imobiliaria: "",
    cnpj: "",
    telefone_suporte: "",
    email_suporte: "",
    email_gestor: "",
    telefone_gestor: "",
  });

  useEffect(() => {
    if (!loading) {
      setForm({
        nome_plataforma: config.nome_plataforma,
        logo_url: config.logo_url || "",
        cor_primaria: config.cor_primaria,
        cor_secundaria: config.cor_secundaria,
        nome_imobiliaria: config.nome_imobiliaria,
        cnpj: config.cnpj || "",
        telefone_suporte: config.telefone_suporte || "",
        email_suporte: config.email_suporte || "",
        email_gestor: config.email_gestor || "",
        telefone_gestor: (config as any).telefone_gestor || "",
      });
    }
  }, [loading, config]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG, SVG ou WEBP.");
      return;
    }

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop();
      const path = `logos/${userData.user?.id}/logo.${ext}`;

      const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: urlData.publicUrl }));
      updateConfig({ logo_url: urlData.publicUrl });
      toast.success("Logo enviada com sucesso!");
    } catch (err) {
      toast.error("Erro ao fazer upload da logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const payload = {
        user_id: userData.user.id,
        nome_plataforma: form.nome_plataforma,
        logo_url: form.logo_url || null,
        cor_primaria: form.cor_primaria,
        cor_secundaria: form.cor_secundaria,
        nome_imobiliaria: form.nome_imobiliaria,
        cnpj: form.cnpj || null,
        telefone_suporte: form.telefone_suporte || null,
        email_suporte: form.email_suporte || null,
        email_gestor: form.email_gestor || null,
        telefone_gestor: form.telefone_gestor || null,
      };

      const { error } = await supabase
        .from("configuracoes_sistema")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      updateConfig({
        nome_plataforma: payload.nome_plataforma,
        logo_url: payload.logo_url,
        nome_imobiliaria: payload.nome_imobiliaria,
        cnpj: payload.cnpj,
        telefone_suporte: payload.telefone_suporte,
        email_suporte: payload.email_suporte,
        email_gestor: payload.email_gestor,
      });
      toast.success("Configurações salvas com sucesso!");
      refetch();
    } catch (err) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Aparência e Identidade</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure o nome, logo e cores da plataforma para a sua imobiliária.
        </p>
      </div>

      {/* Identidade Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Identidade Visual
          </CardTitle>
          <CardDescription>Nome da plataforma, logo e cores principais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Nome da Plataforma</Label>
            <Input
              value={form.nome_plataforma}
              onChange={(e) => setForm((f) => ({ ...f, nome_plataforma: e.target.value }))}
              placeholder="Ex: ImobiSmart, Casa & Cia..."
            />
            <p className="text-xs text-muted-foreground">
              Aparece no sidebar, título da aba e rodapé dos emails.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Logo da Plataforma</Label>
            <div className="flex items-center gap-3">
              {form.logo_url && (
                <img
                  src={form.logo_url}
                  alt="Logo"
                  className="h-12 w-12 object-contain rounded border border-border bg-muted"
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Enviando..." : "Upload da Logo"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Recomendado: 128×128px.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.cor_primaria}
                  onChange={(e) => setForm((f) => ({ ...f, cor_primaria: e.target.value }))}
                  className="h-9 w-9 rounded border border-border cursor-pointer"
                />
                <Input
                  value={form.cor_primaria}
                  onChange={(e) => setForm((f) => ({ ...f, cor_primaria: e.target.value }))}
                  placeholder="#6366f1"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.cor_secundaria}
                  onChange={(e) => setForm((f) => ({ ...f, cor_secundaria: e.target.value }))}
                  className="h-9 w-9 rounded border border-border cursor-pointer"
                />
                <Input
                  value={form.cor_secundaria}
                  onChange={(e) => setForm((f) => ({ ...f, cor_secundaria: e.target.value }))}
                  placeholder="#8b5cf6"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados da Imobiliária */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Dados da Imobiliária
          </CardTitle>
          <CardDescription>Informações institucionais usadas em contratos e emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Imobiliária</Label>
            <Input
              value={form.nome_imobiliaria}
              onChange={(e) => setForm((f) => ({ ...f, nome_imobiliaria: e.target.value }))}
              placeholder="Imobiliária XYZ Ltda."
            />
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input
              value={form.cnpj}
              onChange={(e) => setForm((f) => ({ ...f, cnpj: maskCNPJ(e.target.value) }))}
              placeholder="00.000.000/0001-00"
            />
          </div>
        </CardContent>
      </Card>

      {/* Suporte e Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Suporte e Notificações
          </CardTitle>
          <CardDescription>Contatos exibidos na plataforma e destino dos relatórios automáticos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone de Suporte</Label>
              <Input
                value={form.telefone_suporte}
                onChange={(e) => setForm((f) => ({ ...f, telefone_suporte: maskPhone(e.target.value) }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label>Email de Suporte</Label>
              <Input
                value={form.email_suporte}
                onChange={(e) => setForm((f) => ({ ...f, email_suporte: e.target.value }))}
                placeholder="suporte@imobiliaria.com.br"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email do Gestor (Relatórios Semanais)
            </Label>
            <Input
              value={form.email_gestor}
              onChange={(e) => setForm((f) => ({ ...f, email_gestor: e.target.value }))}
              placeholder="diretor@imobiliaria.com.br"
            />
            <p className="text-xs text-muted-foreground">
              Para este email serão enviados os relatórios semanais automáticos todo domingo.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              WhatsApp do Gestor (Alertas automáticos)
            </Label>
            <Input
              value={form.telefone_gestor}
              onChange={(e) => setForm((f) => ({ ...f, telefone_gestor: maskPhone(e.target.value) }))}
              placeholder="(11) 99999-9999"
            />
            <p className="text-xs text-muted-foreground">
              Recebe alertas de novos leads, contratos assinados e metas atingidas via WhatsApp.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
}
