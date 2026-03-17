import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Imovel } from "@/hooks/useImoveis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalculadoraFinanciamento } from "@/components/financiamento/CalculadoraFinanciamento";
import {
  ArrowLeft, BedDouble, Car, Maximize2, MapPin, Building2, Calculator,
  CheckCircle2, XCircle, Eye, Video, FileText, Calendar,
} from "lucide-react";

const statusConfig: Record<string, { label: string; className: string }> = {
  disponivel: { label: "Disponível", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  reservado:  { label: "Reservado",  className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  vendido:    { label: "Vendido",    className: "bg-gray-500/15 text-gray-600 border-gray-500/30" },
  alugado:    { label: "Alugado",    className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  inativo:    { label: "Inativo",    className: "bg-gray-200 text-gray-500 border-gray-300" },
};

function fmt(val: number | null | undefined) {
  if (!val) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(val));
}

export default function ImovelDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [imovel, setImovel] = useState<Imovel | null>(null);
  const [loading, setLoading] = useState(true);
  const [calcOpen, setCalcOpen] = useState(false);
  const [fotoIdx, setFotoIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    supabase.from("imoveis").select("*").eq("id", id).single().then(({ data }) => {
      setImovel(data as unknown as Imovel);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!imovel) {
    return (
      <div className="p-6 text-center space-y-3">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Imóvel não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/imoveis")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar
        </Button>
      </div>
    );
  }

  const status = statusConfig[imovel.status] || statusConfig.inativo;
  const fotos = imovel.fotos?.length ? imovel.fotos : imovel.foto_destaque ? [imovel.foto_destaque] : [];

  const showVenda = imovel.finalidade === "Venda" || imovel.finalidade === "Venda e Aluguel";
  const showAluguel = imovel.finalidade === "Aluguel" || imovel.finalidade === "Venda e Aluguel" || imovel.finalidade === "Temporada";

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" className="mt-0.5" onClick={() => navigate("/imoveis")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold leading-tight">
              {imovel.titulo || `${imovel.tipo} — ${imovel.bairro || "Sem bairro"}`}
            </h1>
            <Badge variant="outline" className={status.className}>{status.label}</Badge>
            {imovel.codigo && (
              <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{imovel.codigo}</span>
            )}
          </div>
          {(imovel.endereco || imovel.bairro) && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {[imovel.endereco, imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Left: fotos + valores */}
        <div className="md:col-span-3 space-y-4">
          {/* Galeria */}
          <div className="rounded-xl overflow-hidden bg-muted aspect-video relative">
            {fotos.length > 0 ? (
              <>
                <img
                  src={fotos[fotoIdx]}
                  alt={`Foto ${fotoIdx + 1}`}
                  className="w-full h-full object-cover"
                />
                {fotos.length > 1 && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                    {fotos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setFotoIdx(i)}
                        className={`h-2 w-2 rounded-full transition-all ${i === fotoIdx ? "bg-white scale-125" : "bg-white/50"}`}
                      />
                    ))}
                  </div>
                )}
                {fotos.length > 1 && (
                  <>
                    <button
                      onClick={() => setFotoIdx(i => Math.max(0, i - 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 text-xs transition"
                      disabled={fotoIdx === 0}
                    >◀</button>
                    <button
                      onClick={() => setFotoIdx(i => Math.min(fotos.length - 1, i + 1))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 text-xs transition"
                      disabled={fotoIdx === fotos.length - 1}
                    >▶</button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Building2 className="h-16 w-16 opacity-20" />
              </div>
            )}
          </div>

          {/* Miniaturas */}
          {fotos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {fotos.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setFotoIdx(i)}
                  className={`shrink-0 h-16 w-24 rounded overflow-hidden border-2 transition ${i === fotoIdx ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  <img src={f} alt={`Miniatura ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Descrição */}
          {imovel.descricao && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Descrição</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{imovel.descricao}</p>
              </CardContent>
            </Card>
          )}

          {/* Características */}
          {imovel.caracteristicas?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Características</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {imovel.caracteristicas.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: detalhes */}
        <div className="md:col-span-2 space-y-4">
          {/* Valores */}
          <Card>
            <CardContent className="p-4 space-y-3">
              {showVenda && imovel.valor_venda && (
                <div>
                  <p className="text-xs text-muted-foreground">Valor de Venda</p>
                  <p className="text-2xl font-bold text-primary">{fmt(imovel.valor_venda)}</p>
                </div>
              )}
              {showAluguel && imovel.valor_aluguel && (
                <div>
                  <p className="text-xs text-muted-foreground">Valor de Aluguel</p>
                  <p className="text-2xl font-bold text-blue-600">{fmt(imovel.valor_aluguel)}<span className="text-sm font-normal">/mês</span></p>
                </div>
              )}
              {!imovel.valor_venda && !imovel.valor_aluguel && (
                <p className="text-lg font-semibold text-muted-foreground">Consultar</p>
              )}
              {imovel.valor_condominio && (
                <p className="text-xs text-muted-foreground">Condomínio: <span className="font-medium text-foreground">{fmt(imovel.valor_condominio)}/mês</span></p>
              )}
              {imovel.valor_iptu && (
                <p className="text-xs text-muted-foreground">IPTU: <span className="font-medium text-foreground">{fmt(imovel.valor_iptu)}/ano</span></p>
              )}
              {imovel.valor_venda && (
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setCalcOpen(true)}>
                  <Calculator className="h-4 w-4" />Simular Financiamento
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Detalhes físicos */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhes</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <DetailItem icon={<Building2 className="h-3.5 w-3.5" />} label="Tipo" value={imovel.tipo} />
                <DetailItem icon={null} label="Finalidade" value={imovel.finalidade} />
                {imovel.quartos > 0 && <DetailItem icon={<BedDouble className="h-3.5 w-3.5" />} label="Quartos" value={String(imovel.quartos)} />}
                {imovel.suites > 0 && <DetailItem icon={null} label="Suítes" value={String(imovel.suites)} />}
                {imovel.banheiros > 0 && <DetailItem icon={null} label="Banheiros" value={String(imovel.banheiros)} />}
                {imovel.vagas > 0 && <DetailItem icon={<Car className="h-3.5 w-3.5" />} label="Vagas" value={String(imovel.vagas)} />}
                {imovel.area_util && <DetailItem icon={<Maximize2 className="h-3.5 w-3.5" />} label="Área Útil" value={`${imovel.area_util} m²`} />}
                {imovel.area_total && <DetailItem icon={null} label="Área Total" value={`${imovel.area_total} m²`} />}
                {imovel.andar && <DetailItem icon={null} label="Andar" value={`${imovel.andar}º`} />}
                {imovel.mobiliado && imovel.mobiliado !== "nao" && (
                  <DetailItem icon={null} label="Mobiliado" value={imovel.mobiliado === "sim" ? "Sim" : "Semi"} />
                )}
              </div>

              <Separator />

              <div className="space-y-1.5 text-xs">
                <BoolItem label="Aceita Financiamento" value={imovel.aceita_financiamento} />
                <BoolItem label="Aceita Permuta" value={imovel.aceita_permuta} />
              </div>
            </CardContent>
          </Card>

          {/* Portais */}
          {(imovel.publicado_zap || imovel.publicado_vivareal || imovel.publicado_olx) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Publicado em</CardTitle></CardHeader>
              <CardContent className="flex gap-2 flex-wrap">
                {imovel.publicado_zap && <Badge className="bg-orange-500/15 text-orange-600 border border-orange-500/30 text-xs">ZAP Imóveis</Badge>}
                {imovel.publicado_vivareal && <Badge className="bg-green-500/15 text-green-600 border border-green-500/30 text-xs">Viva Real</Badge>}
                {imovel.publicado_olx && <Badge className="bg-purple-500/15 text-purple-600 border border-purple-500/30 text-xs">OLX</Badge>}
              </CardContent>
            </Card>
          )}

          {/* Links */}
          {(imovel.video_url || imovel.tour_virtual_url) && (
            <Card>
              <CardContent className="p-4 space-y-2">
                {imovel.video_url && (
                  <a href={imovel.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Video className="h-4 w-4" />Vídeo do imóvel
                  </a>
                )}
                {imovel.tour_virtual_url && (
                  <a href={imovel.tour_virtual_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Eye className="h-4 w-4" />Tour Virtual 360°
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Registro */}
          {(imovel.matricula || imovel.cartorio_registro || imovel.captado_em) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Registro</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                {imovel.matricula && <p>Matrícula: <span className="text-foreground font-medium">{imovel.matricula}</span></p>}
                {imovel.cartorio_registro && <p>Cartório: <span className="text-foreground font-medium">{imovel.cartorio_registro}</span></p>}
                {imovel.captado_em && (
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Captado em: <span className="text-foreground font-medium">{new Date(imovel.captado_em).toLocaleDateString("pt-BR")}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Calculadora dialog */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Simulação — {imovel.titulo || `${imovel.tipo} · ${imovel.bairro}`}
            </DialogTitle>
          </DialogHeader>
          <CalculadoraFinanciamento valorImovelInicial={imovel.valor_venda ?? undefined} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function BoolItem({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {value
        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />}
      <span className={value ? "text-foreground" : "text-muted-foreground/60"}>{label}</span>
    </div>
  );
}
