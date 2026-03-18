import { useState, memo } from "react";
import { Imovel } from "@/hooks/useImoveis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BedDouble, Car, Maximize2, MapPin, Pencil, Eye, Building2, Calculator } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CalculadoraFinanciamento } from "@/components/financiamento/CalculadoraFinanciamento";

const statusConfig: Record<string, { label: string; className: string }> = {
  disponivel: { label: "Disponível", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  reservado: { label: "Reservado", className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  vendido: { label: "Vendido", className: "bg-gray-500/15 text-gray-600 border-gray-500/30" },
  alugado: { label: "Alugado", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  inativo: { label: "Inativo", className: "bg-gray-200 text-gray-500 border-gray-300" },
};

function formatCurrency(val: number | null | undefined) {
  if (!val) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(val));
}

interface Props {
  imovel: Imovel;
  onEdit: (imovel: Imovel) => void;
}

export const ImovelCard = memo(function ImovelCard({ imovel, onEdit }: Props) {
  const navigate = useNavigate();
  const [calcOpen, setCalcOpen] = useState(false);
  const status = statusConfig[imovel.status] || statusConfig.inativo;

  const showVenda = imovel.finalidade === "Venda" || imovel.finalidade === "Venda e Aluguel";
  const showAluguel = imovel.finalidade === "Aluguel" || imovel.finalidade === "Venda e Aluguel" || imovel.finalidade === "Temporada";
  const ambos = showVenda && showAluguel && imovel.valor_venda && imovel.valor_aluguel;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow group">
      {/* Foto */}
      <div className="relative h-44 bg-muted overflow-hidden">
        {imovel.foto_destaque ? (
          <img
            src={imovel.foto_destaque}
            alt={imovel.titulo || "Imóvel"}
            loading="lazy"
            width={400}
            height={176}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Building2 className="h-12 w-12 opacity-20" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={`text-xs font-medium ${status.className}`}
          >
            {status.label}
          </Badge>
        </div>
        {imovel.codigo && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
            {imovel.codigo}
          </div>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        <div>
          <p className="font-semibold text-sm leading-tight line-clamp-1">
            {imovel.titulo || `${imovel.tipo} · ${imovel.bairro || "Sem bairro"}`}
          </p>
          {imovel.bairro && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {imovel.bairro}{imovel.cidade ? `, ${imovel.cidade}` : ""}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
          <Badge variant="outline" className="text-xs ml-auto">{imovel.tipo}</Badge>
        </div>

        {/* Portal badges */}
        {(imovel.publicado_zap || imovel.publicado_vivareal || imovel.publicado_olx) && (
          <div className="flex gap-1 flex-wrap">
            {imovel.publicado_zap && (
              <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 border border-orange-500/20">
                ZAP
              </span>
            )}
            {imovel.publicado_vivareal && (
              <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-600 border border-green-500/20">
                VIVA
              </span>
            )}
            {imovel.publicado_olx && (
              <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 border border-purple-500/20">
                OLX
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex flex-col">
            {ambos ? (
              <>
                <span className="text-[11px] text-muted-foreground">Venda: <span className="font-bold text-primary">{formatCurrency(imovel.valor_venda)}</span></span>
                <span className="text-[11px] text-muted-foreground">Aluguel: <span className="font-semibold text-blue-600">{formatCurrency(imovel.valor_aluguel)}/mês</span></span>
              </>
            ) : showVenda && imovel.valor_venda ? (
              <p className="font-bold text-sm text-primary">{formatCurrency(imovel.valor_venda)}</p>
            ) : showAluguel && imovel.valor_aluguel ? (
              <p className="font-bold text-sm text-blue-600">{formatCurrency(imovel.valor_aluguel)}<span className="text-xs font-normal">/mês</span></p>
            ) : (
              <p className="font-bold text-sm text-muted-foreground">Consultar</p>
            )}
          </div>
          <div className="flex gap-1">
            {imovel.valor_venda && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Simular financiamento"
                onClick={() => setCalcOpen(true)}
              >
                <Calculator className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => navigate(`/imoveis/${imovel.id}`)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onEdit(imovel)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Calculadora Dialog */}
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
    </Card>
  );
});
