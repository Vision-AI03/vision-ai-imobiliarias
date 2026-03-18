import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import mammoth from "mammoth";

const TIPOS = [
  { value: "compra_venda", label: "Compra e Venda" },
  { value: "locacao_residencial", label: "Locação Residencial" },
  { value: "locacao_comercial", label: "Locação Comercial" },
  { value: "autorizacao_venda", label: "Autorização de Venda" },
  { value: "recibo_sinal", label: "Recibo de Sinal" },
  { value: "outro", label: "Outro" },
];

export interface Template {
  id: string;
  nome: string;
  tipo: string;
  conteudo_template: string;
  pdf_url: string | null;
  arquivo_tipo: string | null;
  created_at: string;
}

interface TemplatesTabProps {
  templates: Template[];
  onRefresh: () => void;
}

// Basic text extraction from standard (non-scanned) PDFs
function extractTextFromPDF(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];

  // Extract text from BT...ET blocks (standard PDF text objects)
  const btEtBlocks = text.match(/BT[\s\S]*?ET/g) || [];
  for (const block of btEtBlocks) {
    // Tj operator: (text) Tj
    const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || [];
    for (const m of tjMatches) {
      const str = m.replace(/^\(/, "").replace(/\)\s*Tj$/, "").trim();
      if (str && /[a-zA-ZÀ-ú]/.test(str)) parts.push(str);
    }
    // TJ operator: [(text)...] TJ
    const tjArrMatches = block.match(/\[([^\]]*)\]\s*TJ/g) || [];
    for (const m of tjArrMatches) {
      const inner = m.replace(/\[/, "").replace(/\]\s*TJ$/, "");
      const strParts = inner.match(/\(([^)]*)\)/g) || [];
      for (const sp of strParts) {
        const str = sp.replace(/^\(/, "").replace(/\)$/, "").trim();
        if (str && /[a-zA-ZÀ-ú]/.test(str)) parts.push(str);
      }
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function getStoragePath(publicUrl: string): string | null {
  try {
    const marker = "/contratos-modelos/";
    const idx = publicUrl.indexOf(marker);
    return idx >= 0 ? publicUrl.substring(idx + marker.length) : null;
  } catch {
    return null;
  }
}

export default function TemplatesTab({ templates, onRefresh }: TemplatesTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePdfUrl, setDeletePdfUrl] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("compra_venda");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setNome("");
    setTipo("compra_venda");
    setFile(null);
  }

  async function handleSave() {
    if (!nome.trim()) {
      toast({ title: "Informe o nome do modelo", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Selecione um arquivo PDF ou DOCX", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (máx 10MB)", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Usuário não autenticado");

      const buffer = await file.arrayBuffer();
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      let extractedText = "";

      if (ext === "docx") {
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        extractedText = result.value.trim();
      } else if (ext === "pdf") {
        extractedText = extractTextFromPDF(buffer);
        if (!extractedText) {
          extractedText = "[Conteúdo do contrato — a IA irá preencher com base nos dados do imóvel e cliente fornecidos]";
        }
      }

      // Upload to Supabase Storage
      const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
      const filePath = `${session.user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("contratos-modelos")
        .upload(filePath, buffer, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("contratos-modelos")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("contrato_templates").insert({
        user_id: session.user.id,
        nome: nome.trim(),
        tipo,
        conteudo_template: extractedText,
        pdf_url: urlData?.publicUrl || null,
        arquivo_tipo: ext,
        placeholders: [],
      } as any);
      if (dbError) throw dbError;

      toast({ title: "Modelo salvo com sucesso!" });
      setDialogOpen(false);
      resetForm();
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro ao salvar modelo", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    if (deletePdfUrl) {
      const path = getStoragePath(deletePdfUrl);
      if (path) await supabase.storage.from("contratos-modelos").remove([path]);
    }
    const { error } = await supabase.from("contrato_templates").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Modelo excluído" });
      onRefresh();
    }
    setDeleteId(null);
    setDeletePdfUrl(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Seus Modelos de Contrato</h2>
          <p className="text-sm text-muted-foreground">
            Faça upload dos seus contratos em PDF ou DOCX para usar com o Preenchimento por IA
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Fazer Upload de Modelo
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-40" />
            <p className="font-medium">Nenhum modelo cadastrado</p>
            <p className="text-xs mt-1 text-center max-w-xs">
              Faça upload dos seus contratos em PDF ou DOCX para começar a usar o preenchimento automático por IA.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Fazer Upload de Modelo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <Card key={t.id} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.nome}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {TIPOS.find(x => x.value === t.tipo)?.label || t.tipo}
                      </Badge>
                      {t.arquivo_tipo && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase">
                          {t.arquivo_tipo}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(t.created_at), "dd/MM/yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {t.pdf_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs gap-1"
                      onClick={() => window.open(t.pdf_url!, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Visualizar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                    onClick={() => { setDeleteId(t.id); setDeletePdfUrl(t.pdf_url); }}
                  >
                    <Trash2 className="h-3 w-3" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fazer Upload de Modelo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do modelo *</Label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Contrato de Locação Residencial"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arquivo (PDF ou DOCX, máx 10MB) *</Label>
              <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                {file ? (
                  <div>
                    <FileText className="h-8 w-8 mx-auto text-primary mb-2" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs h-7"
                      onClick={() => setFile(null)}
                    >
                      Remover
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">PDF ou DOCX</p>
                    <input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                : "Salvar Modelo"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeletePdfUrl(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo e todas as referências serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
