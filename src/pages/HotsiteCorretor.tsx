import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BedDouble, Car, Maximize2, MapPin, Phone, Mail, MessageCircle,
  Building2, Award, CheckCircle2, Loader2, ChevronRight, Home,
} from "lucide-react";

interface Corretor {
  id: string;
  admin_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  creci: string | null;
  cargo: string | null;
  foto_url: string | null;
  bio: string | null;
  slug: string | null;
}

interface Imovel {
  id: string;
  codigo: string | null;
  tipo: string;
  titulo: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  quartos: number;
  vagas: number;
  area_util: number | null;
  valor_venda: number | null;
  valor_aluguel: number | null;
  finalidade: string | null;
  foto_destaque: string | null;
  fotos: string[] | null;
  status: string;
}

interface ConfigImob {
  nome_imobiliaria: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
}

const cargoLabels: Record<string, string> = {
  corretor: "Corretor de Imóveis",
  senior: "Corretor Sênior",
  gerente: "Gerente Comercial",
  diretor: "Diretor Comercial",
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function HotsiteCorretor() {
  const { slug } = useParams<{ slug: string }>();
  const [corretor, setCorretor] = useState<Corretor | null>(null);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [config, setConfig] = useState<ConfigImob | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form
  const [form, setForm] = useState({
    nome: "", telefone: "", email: "",
    tipo_interesse: "compra", mensagem: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedImovel, setSelectedImovel] = useState<Imovel | null>(null);

  useEffect(() => {
    if (slug) loadData(slug);
  }, [slug]);

  async function loadData(slug: string) {
    setLoading(true);

    // Fetch corretor by slug
    const { data: corretorData } = await supabase
      .from("corretores")
      .select("id, admin_id, nome, email, telefone, creci, cargo, foto_url, bio, slug")
      .eq("slug", slug)
      .eq("ativo", true)
      .maybeSingle();

    if (!corretorData) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setCorretor(corretorData);

    // Fetch imóveis disponíveis do corretor
    const { data: imoveisData } = await supabase
      .from("imoveis")
      .select("id, codigo, tipo, titulo, bairro, cidade, estado, quartos, vagas, area_util, valor_venda, valor_aluguel, finalidade, foto_destaque, fotos, status")
      .eq("corretor_responsavel", corretorData.id)
      .eq("status", "disponivel")
      .order("created_at", { ascending: false });
    setImoveis(imoveisData || []);

    // Fetch imobiliária config
    const { data: configData } = await supabase
      .from("configuracoes_sistema")
      .select("nome_imobiliaria, logo_url, cor_primaria")
      .eq("user_id", corretorData.admin_id)
      .maybeSingle();
    setConfig(configData);

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!corretor || !form.nome || !form.telefone) return;
    setSubmitting(true);

    const mensagemFinal = selectedImovel
      ? `Interesse no imóvel: ${selectedImovel.titulo || selectedImovel.tipo} (${selectedImovel.codigo || selectedImovel.id})\n\n${form.mensagem}`
      : form.mensagem;

    const { error } = await supabase.from("leads").insert({
      user_id: corretor.admin_id,
      nome: form.nome,
      telefone: form.telefone,
      email: form.email || null,
      tipo_interesse: form.tipo_interesse,
      mensagem_original: mensagemFinal,
      status: "novo_lead",
      origem_portal: "hotsite",
      corretor_responsavel: corretor.id,
      imoveis_interesse: selectedImovel ? [selectedImovel.id] : null,
    });

    if (error) {
      alert("Erro ao enviar mensagem. Tente novamente.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  function whatsappUrl() {
    if (!corretor?.telefone) return "#";
    const tel = corretor.telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá ${corretor.nome}! Vi seu perfil e gostaria de mais informações sobre imóveis.`);
    return `https://wa.me/55${tel}?text=${msg}`;
  }

  const primary = config?.cor_primaria || "#6366f1";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !corretor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Home className="h-16 w-16 text-gray-300" />
        <h1 className="text-xl font-bold text-gray-700">Corretor não encontrado</h1>
        <p className="text-gray-500 text-sm">O link pode estar desatualizado ou incorreto.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="py-3 px-4 flex items-center justify-between" style={{ backgroundColor: primary }}>
        <div className="flex items-center gap-3">
          {config?.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="h-7 object-contain brightness-0 invert" />
          ) : (
            <Building2 className="h-5 w-5 text-white" />
          )}
          <span className="text-white text-sm font-semibold">
            {config?.nome_imobiliaria || "Imobiliária"}
          </span>
        </div>
        {corretor.telefone && (
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* Perfil do corretor */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="h-24 w-full" style={{ backgroundColor: `${primary}15` }} />
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10">
              {/* Avatar */}
              <div
                className="w-20 h-20 rounded-xl border-4 border-white shadow-md overflow-hidden shrink-0 flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundColor: primary }}
              >
                {corretor.foto_url ? (
                  <img src={corretor.foto_url} alt={corretor.nome} loading="lazy" width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                  corretor.nome.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 pt-2">
                <h1 className="text-2xl font-bold text-gray-900">{corretor.nome}</h1>
                <p className="text-gray-500 text-sm">{cargoLabels[corretor.cargo || "corretor"] || corretor.cargo}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {corretor.creci && (
                    <Badge
                      variant="outline"
                      className="text-xs gap-1"
                      style={{ borderColor: `${primary}40`, color: primary }}
                    >
                      <Award className="h-3 w-3" />
                      CRECI {corretor.creci}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs gap-1 border-green-300 text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Verificado
                  </Badge>
                </div>
              </div>
              {/* Contact buttons */}
              <div className="flex gap-2 sm:ml-auto">
                {corretor.telefone && (
                  <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
                    <Button
                      className="gap-2 text-white"
                      style={{ backgroundColor: "#25D366" }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </a>
                )}
                {corretor.telefone && (
                  <a href={`tel:${corretor.telefone}`}>
                    <Button variant="outline" className="gap-2">
                      <Phone className="h-4 w-4" />
                      Ligar
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {corretor.bio && (
              <p className="mt-4 text-gray-600 text-sm leading-relaxed max-w-2xl">
                {corretor.bio}
              </p>
            )}

            {corretor.email && (
              <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {corretor.email}
              </p>
            )}
          </div>
        </div>

        {/* Imóveis */}
        {imoveis.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              Imóveis Disponíveis
              <span className="text-sm font-normal text-gray-400 ml-2">({imoveis.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {imoveis.map(imovel => {
                const valor = imovel.valor_venda
                  ? fmtBRL(imovel.valor_venda)
                  : imovel.valor_aluguel
                  ? `${fmtBRL(imovel.valor_aluguel)}/mês`
                  : "Consultar";
                const isSelected = selectedImovel?.id === imovel.id;

                return (
                  <div
                    key={imovel.id}
                    onClick={() => setSelectedImovel(isSelected ? null : imovel)}
                    className={`bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? "ring-2" : ""
                    }`}
                    style={isSelected ? { ringColor: primary } : {}}
                  >
                    {/* Foto */}
                    <div className="relative h-40 bg-gray-100">
                      {imovel.foto_destaque ? (
                        <img
                          src={imovel.foto_destaque}
                          alt={imovel.titulo || imovel.tipo}
                          loading="lazy"
                          width={400}
                          height={160}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="h-10 w-10 text-gray-300" />
                        </div>
                      )}
                      {imovel.codigo && (
                        <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                          {imovel.codigo}
                        </span>
                      )}
                      {isSelected && (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ backgroundColor: `${primary}30` }}
                        >
                          <CheckCircle2 className="h-10 w-10 text-white drop-shadow" />
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2">
                      <div>
                        <p className="font-semibold text-sm text-gray-900 line-clamp-1">
                          {imovel.titulo || `${imovel.tipo} — ${imovel.bairro || "Sem bairro"}`}
                        </p>
                        {imovel.bairro && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {imovel.bairro}{imovel.cidade ? `, ${imovel.cidade}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {imovel.quartos > 0 && (
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-3 w-3" />{imovel.quartos}
                          </span>
                        )}
                        {imovel.vagas > 0 && (
                          <span className="flex items-center gap-1">
                            <Car className="h-3 w-3" />{imovel.vagas}
                          </span>
                        )}
                        {imovel.area_util && (
                          <span className="flex items-center gap-1">
                            <Maximize2 className="h-3 w-3" />{imovel.area_util}m²
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                        <span
                          className="font-bold text-sm"
                          style={{ color: primary }}
                        >
                          {valor}
                        </span>
                        <span className="text-xs text-gray-400">{imovel.finalidade}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedImovel && (
              <p className="text-xs text-center text-gray-400">
                ✓ Imóvel selecionado: <strong>{selectedImovel.titulo || selectedImovel.tipo}</strong>. Preencha o formulário abaixo para entrar em contato.
              </p>
            )}
          </div>
        )}

        {/* Formulário de contato */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Entre em Contato</h2>
          <p className="text-sm text-gray-400 mb-5">
            {selectedImovel
              ? `Solicitar informações sobre: ${selectedImovel.titulo || selectedImovel.tipo}`
              : "Preencha seus dados e o corretor entrará em contato."}
          </p>

          {submitted ? (
            <div className="text-center py-10 space-y-3">
              <CheckCircle2 className="h-14 w-14 mx-auto text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900">Mensagem enviada!</h3>
              <p className="text-sm text-gray-500">
                {corretor.nome} receberá sua solicitação e entrará em contato em breve.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSubmitted(false); setForm({ nome: "", telefone: "", email: "", tipo_interesse: "compra", mensagem: "" }); }}
              >
                Enviar outra mensagem
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-700">Nome completo *</Label>
                  <Input
                    required
                    placeholder="João Silva"
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    className="border-gray-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-700">WhatsApp / Telefone *</Label>
                  <Input
                    required
                    placeholder="(11) 99999-9999"
                    value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                    className="border-gray-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-700">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="joao@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="border-gray-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-700">Interesse</Label>
                  <Select
                    value={form.tipo_interesse}
                    onValueChange={v => setForm(f => ({ ...f, tipo_interesse: v }))}
                  >
                    <SelectTrigger className="border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem value="aluguel">Aluguel</SelectItem>
                      <SelectItem value="venda">Quero vender</SelectItem>
                      <SelectItem value="avaliacao">Avaliação de imóvel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-700">Mensagem</Label>
                <Textarea
                  placeholder="Descreva o imóvel que procura, faixa de valor, bairros de interesse..."
                  value={form.mensagem}
                  onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))}
                  className="border-gray-200 min-h-[100px]"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting || !form.nome || !form.telefone}
                className="w-full gap-2 text-white"
                style={{ backgroundColor: primary }}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {submitting ? "Enviando..." : "Enviar Solicitação"}
              </Button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-4">
          {config?.nome_imobiliaria || "Imobiliária"} · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
