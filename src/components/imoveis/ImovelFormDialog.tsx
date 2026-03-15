import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCorretores } from "@/hooks/useCorretores";
import { Imovel } from "@/hooks/useImoveis";
import { X, Plus } from "lucide-react";

const CARACTERISTICAS_OPCOES = [
  "Piscina", "Academia", "Portaria 24h", "Playground", "Salão de festas",
  "Churrasqueira", "Elevador", "Ar-condicionado", "Vista mar", "Vista piscina",
  "Sauna", "Quadra esportiva", "Pet friendly", "Lavanderia", "Depósito",
  "Gerador", "Energia solar", "Vaga coberta", "Varanda gourmet", "Jardim",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imovel?: Imovel | null;
  onSaved: () => void;
}

const emptyForm = {
  codigo: "",
  titulo: "",
  descricao: "",
  tipo: "Apartamento",
  finalidade: "Venda",
  status: "disponivel",
  valor_venda: "",
  valor_aluguel: "",
  valor_condominio: "",
  valor_iptu: "",
  area_total: "",
  area_util: "",
  quartos: "0",
  suites: "0",
  banheiros: "0",
  vagas: "0",
  andar: "",
  total_andares: "",
  aceita_financiamento: true,
  aceita_permuta: false,
  mobiliado: "nao",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  caracteristicas: [] as string[],
  foto_destaque: "",
  video_url: "",
  tour_virtual_url: "",
  matricula: "",
  cartorio_registro: "",
  corretor_responsavel: "",
  captado_em: "",
};

export function ImovelFormDialog({ open, onOpenChange, imovel, onSaved }: Props) {
  const { corretores } = useCorretores();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [activeTab, setActiveTab] = useState("basico");

  useEffect(() => {
    if (imovel) {
      setForm({
        codigo: imovel.codigo || "",
        titulo: imovel.titulo || "",
        descricao: imovel.descricao || "",
        tipo: imovel.tipo,
        finalidade: imovel.finalidade,
        status: imovel.status,
        valor_venda: imovel.valor_venda?.toString() || "",
        valor_aluguel: imovel.valor_aluguel?.toString() || "",
        valor_condominio: imovel.valor_condominio?.toString() || "",
        valor_iptu: imovel.valor_iptu?.toString() || "",
        area_total: imovel.area_total?.toString() || "",
        area_util: imovel.area_util?.toString() || "",
        quartos: imovel.quartos.toString(),
        suites: imovel.suites.toString(),
        banheiros: imovel.banheiros.toString(),
        vagas: imovel.vagas.toString(),
        andar: imovel.andar?.toString() || "",
        total_andares: imovel.total_andares?.toString() || "",
        aceita_financiamento: imovel.aceita_financiamento,
        aceita_permuta: imovel.aceita_permuta,
        mobiliado: imovel.mobiliado,
        endereco: imovel.endereco || "",
        bairro: imovel.bairro || "",
        cidade: imovel.cidade || "",
        estado: imovel.estado || "",
        cep: imovel.cep || "",
        caracteristicas: imovel.caracteristicas || [],
        foto_destaque: imovel.foto_destaque || "",
        video_url: imovel.video_url || "",
        tour_virtual_url: imovel.tour_virtual_url || "",
        matricula: imovel.matricula || "",
        cartorio_registro: imovel.cartorio_registro || "",
        corretor_responsavel: imovel.corretor_responsavel || "",
        captado_em: imovel.captado_em ? imovel.captado_em.split("T")[0] : "",
      });
    } else {
      setForm(emptyForm);
    }
    setActiveTab("basico");
  }, [imovel, open]);

  const buscarCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          endereco: data.logradouro || f.endereco,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }));
        toast.success("Endereço preenchido via CEP.");
      }
    } catch {
      // silently fail
    } finally {
      setLoadingCep(false);
    }
  };

  const toggleCaracteristica = (c: string) => {
    setForm((f) => ({
      ...f,
      caracteristicas: f.caracteristicas.includes(c)
        ? f.caracteristicas.filter((x) => x !== c)
        : [...f.caracteristicas, c],
    }));
  };

  const handleSave = async () => {
    if (!form.tipo || !form.finalidade) {
      toast.error("Tipo e finalidade são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const n = (v: string) => (v ? parseFloat(v) : null);
      const ni = (v: string) => (v ? parseInt(v) : null);

      const payload = {
        user_id: userData.user.id,
        codigo: form.codigo || null,
        titulo: form.titulo || null,
        descricao: form.descricao || null,
        tipo: form.tipo,
        finalidade: form.finalidade,
        status: form.status,
        valor_venda: n(form.valor_venda),
        valor_aluguel: n(form.valor_aluguel),
        valor_condominio: n(form.valor_condominio),
        valor_iptu: n(form.valor_iptu),
        area_total: n(form.area_total),
        area_util: n(form.area_util),
        quartos: ni(form.quartos) || 0,
        suites: ni(form.suites) || 0,
        banheiros: ni(form.banheiros) || 0,
        vagas: ni(form.vagas) || 0,
        andar: ni(form.andar),
        total_andares: ni(form.total_andares),
        aceita_financiamento: form.aceita_financiamento,
        aceita_permuta: form.aceita_permuta,
        mobiliado: form.mobiliado,
        endereco: form.endereco || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
        cep: form.cep || null,
        caracteristicas: form.caracteristicas,
        foto_destaque: form.foto_destaque || null,
        video_url: form.video_url || null,
        tour_virtual_url: form.tour_virtual_url || null,
        matricula: form.matricula || null,
        cartorio_registro: form.cartorio_registro || null,
        corretor_responsavel: form.corretor_responsavel || null,
        captado_em: form.captado_em || null,
      };

      let error;
      if (imovel) {
        ({ error } = await supabase.from("imoveis").update(payload).eq("id", imovel.id));
      } else {
        ({ error } = await supabase.from("imoveis").insert(payload));
      }

      if (error) throw error;
      toast.success(imovel ? "Imóvel atualizado!" : "Imóvel cadastrado!");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar imóvel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{imovel ? "Editar Imóvel" : "Cadastrar Imóvel"}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 text-xs">
            <TabsTrigger value="basico">Básico</TabsTrigger>
            <TabsTrigger value="caracteristicas">Caract.</TabsTrigger>
            <TabsTrigger value="localizacao">Local</TabsTrigger>
            <TabsTrigger value="midia">Mídia</TabsTrigger>
            <TabsTrigger value="legal">Legal</TabsTrigger>
          </TabsList>

          {/* Tab 1 — Básico */}
          <TabsContent value="basico" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código interno</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                  placeholder="AP-0042"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="reservado">Reservado</SelectItem>
                    <SelectItem value="vendido">Vendido</SelectItem>
                    <SelectItem value="alugado">Alugado</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Apartamento", "Casa", "Terreno", "Sala Comercial", "Galpão", "Cobertura", "Studio"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Finalidade *</Label>
                <Select value={form.finalidade} onValueChange={(v) => setForm((f) => ({ ...f, finalidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Venda", "Aluguel", "Venda e Aluguel", "Temporada"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Título do anúncio</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Apartamento 3 quartos com vista mar em Copacabana"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Descrição completa do imóvel..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(form.finalidade === "Venda" || form.finalidade === "Venda e Aluguel") && (
                <div className="space-y-2">
                  <Label>Valor de Venda (R$)</Label>
                  <Input
                    type="number"
                    value={form.valor_venda}
                    onChange={(e) => setForm((f) => ({ ...f, valor_venda: e.target.value }))}
                    placeholder="500000"
                  />
                </div>
              )}
              {(form.finalidade === "Aluguel" || form.finalidade === "Venda e Aluguel" || form.finalidade === "Temporada") && (
                <div className="space-y-2">
                  <Label>Valor de Aluguel (R$)</Label>
                  <Input
                    type="number"
                    value={form.valor_aluguel}
                    onChange={(e) => setForm((f) => ({ ...f, valor_aluguel: e.target.value }))}
                    placeholder="3500"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Condomínio (R$)</Label>
                <Input
                  type="number"
                  value={form.valor_condominio}
                  onChange={(e) => setForm((f) => ({ ...f, valor_condominio: e.target.value }))}
                  placeholder="800"
                />
              </div>
              <div className="space-y-2">
                <Label>IPTU (R$/ano)</Label>
                <Input
                  type="number"
                  value={form.valor_iptu}
                  onChange={(e) => setForm((f) => ({ ...f, valor_iptu: e.target.value }))}
                  placeholder="2400"
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab 2 — Características */}
          <TabsContent value="caracteristicas" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Área total (m²)", key: "area_total" },
                { label: "Área útil (m²)", key: "area_util" },
                { label: "Quartos", key: "quartos" },
                { label: "Suítes", key: "suites" },
                { label: "Banheiros", key: "banheiros" },
                { label: "Vagas", key: "vagas" },
                { label: "Andar", key: "andar" },
                { label: "Total andares", key: "total_andares" },
              ].map(({ label, key }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Mobiliado</Label>
              <Select value={form.mobiliado} onValueChange={(v) => setForm((f) => ({ ...f, mobiliado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não mobiliado</SelectItem>
                  <SelectItem value="semi">Semi mobiliado</SelectItem>
                  <SelectItem value="sim">Mobiliado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.aceita_financiamento}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, aceita_financiamento: !!v }))}
                />
                <Label>Aceita financiamento</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.aceita_permuta}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, aceita_permuta: !!v }))}
                />
                <Label>Aceita permuta</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Características e diferenciais</Label>
              <div className="flex flex-wrap gap-2">
                {CARACTERISTICAS_OPCOES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCaracteristica(c)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      form.caracteristicas.includes(c)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary hover:text-primary"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 3 — Localização */}
          <TabsContent value="localizacao" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-1">
                <Label>CEP</Label>
                <Input
                  value={form.cep}
                  onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))}
                  onBlur={(e) => buscarCep(e.target.value)}
                  placeholder="00000-000"
                />
                {loadingCep && <p className="text-xs text-muted-foreground">Buscando...</p>}
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Endereço</Label>
                <Input
                  value={form.endereco}
                  onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
                  placeholder="Rua das Flores, 123"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={form.bairro}
                  onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={form.cidade}
                  onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab 4 — Mídia */}
          <TabsContent value="midia" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>URL da foto destaque</Label>
              <Input
                value={form.foto_destaque}
                onChange={(e) => setForm((f) => ({ ...f, foto_destaque: e.target.value }))}
                placeholder="https://..."
              />
              {form.foto_destaque && (
                <img
                  src={form.foto_destaque}
                  alt="Destaque"
                  className="h-32 w-full object-cover rounded-lg border border-border"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>URL do vídeo</Label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                placeholder="https://youtube.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>URL do tour virtual</Label>
              <Input
                value={form.tour_virtual_url}
                onChange={(e) => setForm((f) => ({ ...f, tour_virtual_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </TabsContent>

          {/* Tab 5 — Legal */}
          <TabsContent value="legal" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input
                  value={form.matricula}
                  onChange={(e) => setForm((f) => ({ ...f, matricula: e.target.value }))}
                  placeholder="123456"
                />
              </div>
              <div className="space-y-2">
                <Label>Cartório de Registro</Label>
                <Input
                  value={form.cartorio_registro}
                  onChange={(e) => setForm((f) => ({ ...f, cartorio_registro: e.target.value }))}
                  placeholder="1º Cartório de Registro de Imóveis"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Corretor responsável</Label>
                <Select
                  value={form.corretor_responsavel}
                  onValueChange={(v) => setForm((f) => ({ ...f, corretor_responsavel: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem corretor</SelectItem>
                    {corretores.filter(c => c.ativo).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de captação</Label>
                <Input
                  type="date"
                  value={form.captado_em}
                  onChange={(e) => setForm((f) => ({ ...f, captado_em: e.target.value }))}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : imovel ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
