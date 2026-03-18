import { useState, useMemo } from "react";
import { useImoveis, Imovel } from "@/hooks/useImoveis";
import { supabase } from "@/integrations/supabase/client";
import { ImovelCard } from "@/components/imoveis/ImovelCard";
import { ImovelFormDialog } from "@/components/imoveis/ImovelFormDialog";
import ImportImoveisModal from "@/components/imoveis/ImportImoveisModal";
import UploadFotosImoveisModal from "@/components/imoveis/UploadFotosImoveisModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Home, Plus, LayoutGrid, List, Search, X, Pencil, Scale, CheckSquare, Square, FileSpreadsheet, Images } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const TIPOS = ["Apartamento", "Casa", "Terreno", "Sala Comercial", "Galpão", "Cobertura", "Studio"];
const FINALIDADES = ["Venda", "Aluguel", "Venda e Aluguel", "Temporada"];
const STATUS = ["disponivel", "reservado", "vendido", "alugado", "inativo"];

const statusLabels: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  inativo: "Inativo",
};

interface ImovelSemFoto {
  id: string;
  codigo: string | null;
  titulo: string | null;
  tipo: string;
  bairro: string | null;
}

export default function Imoveis() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Imovel | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [fotosOpen, setFotosOpen] = useState(false);
  const [imovelsSemFoto, setImovelsSemFoto] = useState<ImovelSemFoto[]>([]);

  const [filters, setFilters] = useState({
    tipo: "",
    finalidade: "",
    status: "",
    busca: "",
  });

  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Imovel[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const { imoveis, loading, refetch } = useImoveis({
    tipo: filters.tipo || undefined,
    finalidade: filters.finalidade || undefined,
    status: filters.status || undefined,
    busca: filters.busca || undefined,
  });

  function toggleCompare(imovel: Imovel) {
    setSelectedForCompare(prev => {
      const exists = prev.find(i => i.id === imovel.id);
      if (exists) return prev.filter(i => i.id !== imovel.id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, imovel];
    });
  }

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (imovel: Imovel) => {
    setEditing(imovel);
    setDialogOpen(true);
  };

  const handleImported = async (ids: string[]) => {
    refetch();
    if (ids.length === 0) return;
    // Fetch imported imoveis to check which have no photos
    const { data } = await supabase
      .from("imoveis")
      .select("id, codigo, titulo, tipo, bairro, fotos")
      .in("id", ids);
    const semFoto = (data || []).filter((i: { fotos: string[] }) => !i.fotos || i.fotos.length === 0);
    if (semFoto.length > 0) {
      setImovelsSemFoto(semFoto as ImovelSemFoto[]);
    }
  };

  const clearFilters = () => setFilters({ tipo: "", finalidade: "", status: "", busca: "" });
  const hasFilters = filters.tipo || filters.finalidade || filters.status || filters.busca;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of imoveis) {
      counts[i.status] = (counts[i.status] || 0) + 1;
    }
    return counts;
  }, [imoveis]);
  const disponiveisCount = statusCounts["disponivel"] || 0;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            Imóveis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {imoveis.length !== 1 ? `${imoveis.length} imóveis` : "1 imóvel"} · {disponiveisCount !== 1 ? `${disponiveisCount} disponíveis` : "1 disponível"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={compareMode ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setCompareMode(v => !v);
              if (compareMode) setSelectedForCompare([]);
            }}
          >
            <Scale className="h-4 w-4" />
            {compareMode ? `Comparar (${selectedForCompare.length}/3)` : "Comparar"}
          </Button>
          {compareMode && selectedForCompare.length >= 2 && (
            <Button size="sm" className="gap-1.5" onClick={() => setCompareOpen(true)}>
              Ver Comparativo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView(view === "grid" ? "list" : "grid")}
          >
            {view === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar em Lote
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Imóvel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, bairro, código..."
            className="pl-9"
            value={filters.busca}
            onChange={(e) => setFilters((f) => ({ ...f, busca: e.target.value }))}
          />
        </div>

        <Select
          value={filters.tipo}
          onValueChange={(v) => setFilters((f) => ({ ...f, tipo: v === "todos" ? "" : v }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={filters.finalidade}
          onValueChange={(v) => setFilters((f) => ({ ...f, finalidade: v === "todas" ? "" : v }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Finalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {FINALIDADES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "todos" ? "" : v }))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS.map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Banner: fotos pós-importação */}
      {imovelsSemFoto.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <Images className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm flex-1">
            Você importou <span className="font-semibold">{imovelsSemFoto.length} imóvel{imovelsSemFoto.length !== 1 ? "is" : ""}</span> sem fotos. Deseja adicionar fotos agora?
          </p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setImovelsSemFoto([])}>
              Agora não
            </Button>
            <Button size="sm" className="text-xs h-7 gap-1" onClick={() => setFotosOpen(true)}>
              <Images className="h-3.5 w-3.5" />
              Adicionar Fotos
            </Button>
          </div>
        </div>
      )}

      {/* Stats rápidas */}
      <div className="flex gap-2 flex-wrap">
        {["disponivel", "reservado", "vendido", "alugado"].map((s) => {
          const count = statusCounts[s] || 0;
          if (!count) return null;
          return (
            <Badge key={s} variant="outline" className="text-xs">
              {statusLabels[s]}: {count}
            </Badge>
          );
        })}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : imoveis.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Home className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">
            {hasFilters ? "Nenhum imóvel encontrado" : "Nenhum imóvel cadastrado"}
          </p>
          <p className="text-sm">
            {hasFilters
              ? "Tente outros filtros ou limpe a busca."
              : "Clique em \"Cadastrar Imóvel\" para começar."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {imoveis.map((imovel) => {
            const isSelected = selectedForCompare.some(i => i.id === imovel.id);
            const isDisabled = compareMode && !isSelected && selectedForCompare.length >= 3;
            return (
              <div key={imovel.id} className={`relative ${isDisabled ? "opacity-40" : ""}`}>
                {compareMode && (
                  <button
                    className={`absolute top-2 left-2 z-10 rounded-md p-1 transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "bg-background/80 text-muted-foreground border border-border"}`}
                    onClick={() => toggleCompare(imovel)}
                    disabled={isDisabled}
                  >
                    {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                )}
                <ImovelCard imovel={imovel} onEdit={openEdit} />
              </div>
            );
          })}
        </div>
      ) : (
        <ImovelListView imoveis={imoveis} onEdit={openEdit} />
      )}

      <ImovelFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        imovel={editing}
        onSaved={refetch}
      />

      <ImportImoveisModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />

      <UploadFotosImoveisModal
        open={fotosOpen}
        onOpenChange={setFotosOpen}
        imoveis={imovelsSemFoto}
        onDone={() => { setImovelsSemFoto([]); refetch(); }}
      />

      {/* Comparator Dialog */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Comparativo de Imóveis
            </DialogTitle>
          </DialogHeader>
          {selectedForCompare.length >= 2 && (
            <div className={`grid gap-4 ${selectedForCompare.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {selectedForCompare.map((im) => (
                <div key={im.id} className="space-y-3">
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
                    <p className="text-sm font-semibold truncate">{im.titulo || `${im.tipo} — ${im.bairro}`}</p>
                    <p className="text-xs text-muted-foreground">{im.codigo || "Sem código"}</p>
                  </div>
                  <CompareRow label="Tipo" value={im.tipo} />
                  <CompareRow label="Finalidade" value={im.finalidade} />
                  <CompareRow label="Bairro" value={im.bairro} />
                  <CompareRow label="Cidade" value={im.cidade} />
                  <CompareRow label="Área" value={im.area_util ? `${im.area_util} m²` : null} />
                  <CompareRow label="Quartos" value={im.quartos != null ? String(im.quartos) : null} />
                  <CompareRow label="Banheiros" value={(im as any).banheiros != null ? String((im as any).banheiros) : null} />
                  <CompareRow label="Vagas" value={im.vagas != null ? String(im.vagas) : null} />
                  <CompareRow label="Andar" value={(im as any).andar != null ? `${(im as any).andar}º` : null} />
                  <CompareRow
                    label="Valor Venda"
                    value={im.valor_venda != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(im.valor_venda)) : null}
                    highlight
                  />
                  <CompareRow
                    label="Valor Aluguel"
                    value={im.valor_aluguel != null ? `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(im.valor_aluguel))}/mês` : null}
                    highlight
                  />
                  <CompareRow label="Condomínio" value={(im as any).valor_condominio != null ? `R$ ${(im as any).valor_condominio?.toLocaleString("pt-BR")}` : null} />
                  <CompareRow label="IPTU" value={(im as any).valor_iptu != null ? `R$ ${(im as any).valor_iptu?.toLocaleString("pt-BR")}/ano` : null} />
                  <CompareRow label="Status" value={statusLabels[im.status || ""] || im.status} />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompareRow({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div className={`text-xs rounded px-2 py-1.5 ${highlight ? "bg-primary/5" : "bg-muted/30"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-medium mt-0.5 ${highlight ? "text-primary" : ""} ${!value ? "text-muted-foreground/50" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function ImovelListView({ imoveis, onEdit }: { imoveis: Imovel[]; onEdit: (i: Imovel) => void }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Código</th>
            <th className="text-left px-4 py-3 font-medium">Tipo / Bairro</th>
            <th className="text-left px-4 py-3 font-medium">Finalidade</th>
            <th className="text-left px-4 py-3 font-medium">Valor</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium">Quartos/Vagas</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {imoveis.map((imovel) => (
            <tr key={imovel.id} className="border-t hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">{imovel.codigo || "—"}</td>
              <td className="px-4 py-3">
                <p className="font-medium">{imovel.tipo}</p>
                <p className="text-xs text-muted-foreground">{imovel.bairro || "—"}{imovel.cidade ? `, ${imovel.cidade}` : ""}</p>
              </td>
              <td className="px-4 py-3 text-xs">{imovel.finalidade}</td>
              <td className="px-4 py-3 text-xs">
                {(() => {
                  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
                  const fin = imovel.finalidade;
                  const showVenda = fin === "Venda" || fin === "Venda e Aluguel";
                  const showAluguel = fin === "Aluguel" || fin === "Venda e Aluguel" || fin === "Temporada";
                  const ambos = showVenda && showAluguel && imovel.valor_venda && imovel.valor_aluguel;
                  if (ambos) return (
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold text-primary">{fmt(imovel.valor_venda!)}</span>
                      <span className="text-blue-600">{fmt(imovel.valor_aluguel!)}/mês</span>
                    </span>
                  );
                  if (showVenda && imovel.valor_venda) return <span className="font-semibold text-primary">{fmt(imovel.valor_venda)}</span>;
                  if (showAluguel && imovel.valor_aluguel) return <span className="font-semibold text-blue-600">{fmt(imovel.valor_aluguel)}/mês</span>;
                  return <span className="text-muted-foreground">Consultar</span>;
                })()}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="text-xs">
                  {imovel.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {imovel.quartos}q / {imovel.vagas}v
              </td>
              <td className="px-4 py-3">
                <Button variant="ghost" size="sm" onClick={() => onEdit(imovel)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

