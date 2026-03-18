import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileSpreadsheet, FileText, Loader2, CheckCircle2,
  AlertTriangle, X, ChevronRight, RotateCcw,
} from "lucide-react";

const TIPOS = ["Apartamento", "Casa", "Terreno", "Sala Comercial", "Galpão", "Cobertura", "Studio"];
const FINALIDADES = ["Venda", "Aluguel", "Venda e Aluguel"];

const TIPO_PREFIXES: Record<string, string> = {
  Apartamento: "AP", Casa: "CA", Terreno: "TE",
  "Sala Comercial": "SC", Galpão: "GA", Cobertura: "CO", Studio: "ST",
};

export interface ImovelExtracted {
  _id: string;
  titulo: string;
  tipo: string;
  finalidade: string;
  status: string;
  valor_venda: number | null;
  valor_aluguel: number | null;
  area_total: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  descricao: string | null;
  caracteristicas: string[];
  _error?: string;
}

type Step = "upload" | "processing" | "preview" | "importing";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: (ids: string[]) => void;
}

function needsReview(row: ImovelExtracted): boolean {
  return !row.titulo || !row.tipo || (!row.valor_venda && !row.valor_aluguel);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readExcelOrCsv(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
        resolve(JSON.stringify(json, null, 2));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export default function ImportImoveisModal({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImovelExtracted[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setRows([]);
    setSelected(new Set());
    setProgress({ current: 0, total: 0 });
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const validateFile = (f: File): string | null => {
    if (f.size > 10 * 1024 * 1024) return "Arquivo muito grande. Máximo 10MB.";
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv", "pdf"].includes(ext || "")) {
      return "Formato não suportado. Use .xlsx, .csv ou .pdf";
    }
    return null;
  };

  const processFile = useCallback(async (f: File) => {
    const err = validateFile(f);
    if (err) { toast({ title: err, variant: "destructive" }); return; }

    setFile(f);
    setStep("processing");

    try {
      const ext = f.name.split(".").pop()?.toLowerCase();
      const isPdf = ext === "pdf";

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      let body: Record<string, string>;
      if (isPdf) {
        const pdf_base64 = await readFileAsBase64(f);
        body = { pdf_base64, file_name: f.name };
      } else {
        const content_text = await readExcelOrCsv(f);
        body = { content_text };
      }

      const { data, error } = await supabase.functions.invoke("import-imoveis", { body });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erro ao processar arquivo");

      const extracted: ImovelExtracted[] = (data.imoveis || []).map((item: Omit<ImovelExtracted, "_id">, idx: number) => ({
        _id: `row-${idx}-${Date.now()}`,
        titulo: item.titulo || "",
        tipo: TIPOS.includes(item.tipo) ? item.tipo : "Apartamento",
        finalidade: FINALIDADES.includes(item.finalidade) ? item.finalidade : "Venda",
        status: "disponivel",
        valor_venda: item.valor_venda ?? null,
        valor_aluguel: item.valor_aluguel ?? null,
        area_total: item.area_total ?? null,
        quartos: item.quartos ?? null,
        banheiros: item.banheiros ?? null,
        vagas: item.vagas ?? null,
        endereco: item.endereco ?? null,
        bairro: item.bairro ?? null,
        cidade: item.cidade ?? null,
        estado: item.estado ?? null,
        cep: item.cep ?? null,
        descricao: item.descricao ?? null,
        caracteristicas: Array.isArray(item.caracteristicas) ? item.caracteristicas : [],
      }));

      if (extracted.length === 0) {
        toast({
          title: "Nenhum imóvel identificado",
          description: "Não conseguimos identificar imóveis neste arquivo. Verifique o formato e tente novamente.",
          variant: "destructive",
        });
        setStep("upload");
        return;
      }

      setRows(extracted);
      setSelected(new Set(extracted.map(r => r._id)));
      setStep("preview");
    } catch (e: unknown) {
      console.error("processFile error:", e);
      toast({
        title: "Erro ao processar arquivo",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
      setStep("upload");
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

  const updateRow = (id: string, field: keyof ImovelExtracted, value: unknown) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r._id !== id));
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === rows.length ? new Set() : new Set(rows.map(r => r._id))
    );
  };

  const handleImport = async () => {
    const toImport = rows.filter(r => selected.has(r._id));
    if (toImport.length === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast({ title: "Não autenticado", variant: "destructive" }); return; }
    const userId = session.user.id;

    setStep("importing");
    setProgress({ current: 0, total: toImport.length });

    // Fetch existing codes to generate sequential ones
    const { data: existingCodes } = await supabase
      .from("imoveis")
      .select("codigo")
      .eq("user_id", userId)
      .not("codigo", "is", null);

    const codeMap: Record<string, number> = {};
    for (const row of existingCodes || []) {
      if (!row.codigo) continue;
      const m = row.codigo.match(/^([A-Z]{2})-(\d{4})$/);
      if (m) codeMap[m[1]] = Math.max(codeMap[m[1]] || 0, parseInt(m[2]));
    }

    const genCode = (tipo: string) => {
      const prefix = TIPO_PREFIXES[tipo] || "IM";
      const next = (codeMap[prefix] || 0) + 1;
      codeMap[prefix] = next;
      return `${prefix}-${String(next).padStart(4, "0")}`;
    };

    const importedIds: string[] = [];
    const updatedRows = [...rows];

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      setProgress({ current: i + 1, total: toImport.length });

      const { data: inserted, error } = await supabase.from("imoveis").insert({
        user_id: userId,
        codigo: genCode(row.tipo),
        titulo: row.titulo || null,
        tipo: row.tipo,
        finalidade: row.finalidade,
        status: row.status || "disponivel",
        valor_venda: row.valor_venda,
        valor_aluguel: row.valor_aluguel,
        area_total: row.area_total,
        quartos: row.quartos ?? 0,
        banheiros: row.banheiros ?? 0,
        vagas: row.vagas ?? 0,
        endereco: row.endereco,
        bairro: row.bairro,
        cidade: row.cidade,
        estado: row.estado,
        cep: row.cep,
        descricao: row.descricao,
        caracteristicas: row.caracteristicas,
        fotos: [],
        suites: 0,
        aceita_financiamento: false,
        aceita_permuta: false,
        mobiliado: "nao",
        publicado_zap: false,
        publicado_vivareal: false,
        publicado_olx: false,
        visitas_count: 0,
      }).select("id").single();

      const rowIdx = updatedRows.findIndex(r => r._id === row._id);
      if (error) {
        if (rowIdx !== -1) updatedRows[rowIdx] = { ...updatedRows[rowIdx], _error: error.message };
      } else if (inserted?.id) {
        importedIds.push(inserted.id);
        if (rowIdx !== -1) updatedRows[rowIdx] = { ...updatedRows[rowIdx], _error: undefined };
      }
    }

    setRows(updatedRows);

    const failed = toImport.length - importedIds.length;
    toast({
      title: `${importedIds.length} imóvel${importedIds.length !== 1 ? "is" : ""} importado${importedIds.length !== 1 ? "s" : ""} com sucesso!${failed > 0 ? ` (${failed} com erro)` : ""}`,
    });

    onImported(importedIds);
    handleClose();
  };

  const selectedCount = selected.size;
  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Imóveis em Lote
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            {(["upload", "processing", "preview", "importing"] as Step[]).map((s, idx, arr) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`font-medium ${step === s ? "text-primary" : step === "preview" && idx < 2 ? "text-muted-foreground line-through" : ""}`}>
                  {s === "upload" ? "Upload" : s === "processing" ? "Análise IA" : s === "preview" ? "Revisão" : "Importando"}
                </span>
                {idx < arr.length - 1 && <ChevronRight className="h-3 w-3" />}
              </span>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* ── STEP: UPLOAD ── */}
          {step === "upload" && (
            <div className="p-6">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">Arraste sua planilha, CSV ou PDF com os imóveis</p>
                    <p className="text-sm text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls, .csv, .pdf</p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    Ou clique para selecionar arquivo
                  </Button>
                  <p className="text-xs text-muted-foreground">Tamanho máximo: 10MB</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
              />

              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                {[
                  { icon: FileSpreadsheet, label: "Excel / CSV", desc: "Planilha com lista de imóveis" },
                  { icon: FileText, label: "PDF", desc: "Listagem de portais ou documentos" },
                  { icon: Upload, label: "Qualquer formato", desc: "A IA interpreta automaticamente" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="rounded-lg border bg-muted/20 p-4">
                    <Icon className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: PROCESSING ── */}
          {step === "processing" && (
            <div className="p-12 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <div className="rounded-full bg-primary/10 p-6">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Analisando com IA...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Identificando imóveis em <span className="font-medium">{file?.name}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
              </div>
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === "preview" && (
            <div className="flex flex-col">
              {/* Header da tabela */}
              <div className="flex items-center justify-between px-6 py-3 bg-muted/30 border-b shrink-0">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {rows.length} imóvel{rows.length !== 1 ? "is" : ""} identificado{rows.length !== 1 ? "s" : ""}
                  </span>
                  <Badge variant="outline" className="text-xs">{file?.name}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={toggleAll}>
                    {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={reset}>
                    <RotateCcw className="h-3 w-3" />
                    Novo arquivo
                  </Button>
                </div>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="w-10 px-3 py-2.5 text-left">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium min-w-[160px]">Título</th>
                      <th className="px-3 py-2.5 text-left font-medium w-32">Tipo</th>
                      <th className="px-3 py-2.5 text-left font-medium w-36">Finalidade</th>
                      <th className="px-3 py-2.5 text-left font-medium w-32">Valor Venda</th>
                      <th className="px-3 py-2.5 text-left font-medium w-32">Valor Aluguel</th>
                      <th className="px-3 py-2.5 text-left font-medium w-24">Bairro</th>
                      <th className="px-3 py-2.5 text-left font-medium w-12">Q</th>
                      <th className="px-3 py-2.5 text-left font-medium w-12">V</th>
                      <th className="px-3 py-2.5 text-left font-medium w-20">Status</th>
                      <th className="w-8 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const review = needsReview(row);
                      const isSelected = selected.has(row._id);
                      return (
                        <tr
                          key={row._id}
                          className={`border-t transition-colors ${row._error ? "bg-destructive/5" : isSelected ? "hover:bg-muted/30" : "opacity-50 hover:bg-muted/20"}`}
                        >
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(row._id)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={row.titulo}
                              onChange={(e) => updateRow(row._id, "titulo", e.target.value)}
                              className="h-7 text-xs min-w-[140px]"
                              placeholder="Título do imóvel"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select value={row.tipo} onValueChange={(v) => updateRow(row._id, "tipo", v)}>
                              <SelectTrigger className="h-7 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIPOS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Select value={row.finalidade} onValueChange={(v) => updateRow(row._id, "finalidade", v)}>
                              <SelectTrigger className="h-7 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FINALIDADES.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={row.valor_venda ?? ""}
                              onChange={(e) => updateRow(row._id, "valor_venda", e.target.value ? Number(e.target.value) : null)}
                              className="h-7 text-xs w-full"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={row.valor_aluguel ?? ""}
                              onChange={(e) => updateRow(row._id, "valor_aluguel", e.target.value ? Number(e.target.value) : null)}
                              className="h-7 text-xs w-full"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={row.bairro ?? ""}
                              onChange={(e) => updateRow(row._id, "bairro", e.target.value || null)}
                              className="h-7 text-xs w-full"
                              placeholder="Bairro"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={row.quartos ?? ""}
                              onChange={(e) => updateRow(row._id, "quartos", e.target.value ? Number(e.target.value) : null)}
                              className="h-7 text-xs w-16"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={row.vagas ?? ""}
                              onChange={(e) => updateRow(row._id, "vagas", e.target.value ? Number(e.target.value) : null)}
                              className="h-7 text-xs w-16"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {row._error ? (
                              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                                Erro
                              </Badge>
                            ) : review ? (
                              <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30 gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Verificar
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30 gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Pronto
                              </Badge>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => removeRow(row._id)}
                              className="text-muted-foreground/50 hover:text-destructive transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STEP: IMPORTING ── */}
          {step === "importing" && (
            <div className="p-12 flex flex-col items-center justify-center gap-6">
              <div className="rounded-full bg-primary/10 p-5">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <div className="text-center w-full max-w-sm">
                <p className="text-base font-semibold mb-1">
                  Importando {progress.current} de {progress.total}...
                </p>
                <Progress
                  value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {Math.round((progress.current / Math.max(progress.total, 1)) * 100)}% concluído
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer com ações */}
        {(step === "preview") && (
          <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between bg-background">
            <p className="text-sm text-muted-foreground">
              {selectedCount} de {rows.length} selecionado{selectedCount !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                Importar {selectedCount > 0 ? `${selectedCount} ` : ""}Selecionado{selectedCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
