import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Plus, Trash2, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

const NICHOS = [
  { value: "clinicas", label: "Clínicas" },
  { value: "imobiliarias", label: "Imobiliárias" },
  { value: "contabilidade", label: "Contabilidade" },
  { value: "transportadoras", label: "Transportadoras" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "restaurantes", label: "Restaurantes" },
  { value: "outro", label: "Outro" },
];

interface EmailList {
  id: string;
  nome: string;
  nicho: string;
  total_emails: number;
  emails_enviados: number;
  emails_abertos: number;
  emails_respondidos: number;
  status: string;
  arquivo_origem: string | null;
  created_at: string;
}

interface Props {
  listas: EmailList[];
  onRefresh: () => void;
}

interface ParsedContact {
  nome?: string;
  email: string;
  empresa?: string;
  cargo?: string;
  telefone?: string;
  [key: string]: any;
}

export function ListasTab({ listas, onRefresh }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const [detailList, setDetailList] = useState<EmailList | null>(null);
  const [detailContatos, setDetailContatos] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { toast } = useToast();

  // Import form state
  const [nome, setNome] = useState("");
  const [nicho, setNicho] = useState("");
  const [nichoCustom, setNichoCustom] = useState("");
  const [descricao, setDescricao] = useState("");
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({
    nome: "", email: "", empresa: "", cargo: "", telefone: "",
  });

  function resetForm() {
    setNome("");
    setNicho("");
    setNichoCustom("");
    setDescricao("");
    setParsedContacts([]);
    setFileName("");
    setAvailableColumns([]);
    setColumnMap({ nome: "", email: "", empresa: "", cargo: "", telefone: "" });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsing(true);

    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      if (ext === "docx" || ext === "doc") {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        const text = result.value;

        // Extract emails with optional surrounding context for name
        const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
        const emails = [...new Set(text.match(emailRegex) || [])];

        if (emails.length === 0) {
          toast({ title: "Nenhum email encontrado no documento", variant: "destructive" });
          setParsing(false);
          return;
        }

        // Try to extract name from the line containing the email
        const lines = text.split(/\r?\n/);
        const contacts: ParsedContact[] = emails.map(email => {
          const line = lines.find(l => l.includes(email)) || "";
          const namePart = line.replace(email, "").replace(/[|;,\t]+/g, " ").trim();
          return { email, nome: namePart || "" };
        });

        setParsedContacts(contacts);
        toast({ title: `${contacts.length} emails encontrados no documento Word` });
      } else if (ext === "csv" || ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        if (jsonData.length === 0) {
          toast({ title: "Arquivo vazio", variant: "destructive" });
          setParsing(false);
          return;
        }

        const cols = Object.keys(jsonData[0]);
        setAvailableColumns(cols);

        // Auto-detect columns
        const autoMap: Record<string, string> = { nome: "", email: "", empresa: "", cargo: "", telefone: "" };
        for (const col of cols) {
          const lower = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (lower.includes("nome") || lower.includes("name")) autoMap.nome = col;
          else if (lower.includes("email") || lower.includes("e-mail")) autoMap.email = col;
          else if (lower.includes("empresa") || lower.includes("company")) autoMap.empresa = col;
          else if (lower.includes("cargo") || lower.includes("position") || lower.includes("title")) autoMap.cargo = col;
          else if (lower.includes("telefone") || lower.includes("phone") || lower.includes("tel")) autoMap.telefone = col;
        }
        setColumnMap(autoMap);

        // Apply mapping to get contacts
        const contacts: ParsedContact[] = jsonData.map(row => ({
          nome: autoMap.nome ? String(row[autoMap.nome] || "") : "",
          email: autoMap.email ? String(row[autoMap.email] || "") : "",
          empresa: autoMap.empresa ? String(row[autoMap.empresa] || "") : "",
          cargo: autoMap.cargo ? String(row[autoMap.cargo] || "") : "",
          telefone: autoMap.telefone ? String(row[autoMap.telefone] || "") : "",
        })).filter(c => c.email && c.email.includes("@"));

        setParsedContacts(contacts);
        toast({ title: `${contacts.length} contatos encontrados` });
      } else if (ext === "pdf") {
        // Read PDF as text using FileReader, then send to AI
        const text = await file.text();
        const { data, error } = await supabase.functions.invoke("parse-pdf-contacts", {
          body: { pdf_text: text },
        });

        if (error) throw error;
        const contacts = (data?.contatos || []).filter((c: any) => c.email?.includes("@"));
        setParsedContacts(contacts);
        toast({ title: `${contacts.length} contatos extraídos do PDF` });
      } else {
        toast({ title: "Formato não suportado. Use .csv, .xlsx, .xls, .docx, .doc ou .pdf", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao processar arquivo", description: err.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }

  function reapplyMapping() {
    if (!availableColumns.length) return;
    // Re-read file would be needed; for now just show the auto-detected mapping
    toast({ title: "Mapeamento atualizado. Re-importe o arquivo se precisar re-mapear." });
  }

  async function handleSaveList() {
    if (!nome || !nicho || parsedContacts.length === 0) {
      toast({ title: "Preencha nome, nicho e importe um arquivo", variant: "destructive" });
      return;
    }

    setSaving(true);
    const finalNicho = nicho === "outro" ? nichoCustom || "outro" : nicho;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Create list
      const { data: list, error: listErr } = await supabase
        .from("email_lists")
        .insert({
          user_id: user.id,
          nome,
          nicho: finalNicho,
          descricao,
          total_emails: parsedContacts.length,
          arquivo_origem: fileName,
        })
        .select()
        .single();

      if (listErr) throw listErr;

      // Insert contacts in batches
      const batchSize = 100;
      for (let i = 0; i < parsedContacts.length; i += batchSize) {
        const batch = parsedContacts.slice(i, i + batchSize).map(c => ({
          user_id: user.id,
          lista_id: list.id,
          nome: c.nome || null,
          email: c.email,
          empresa: c.empresa || null,
          cargo: c.cargo || null,
          telefone: c.telefone || null,
        }));

        const { error: batchErr } = await supabase.from("email_contatos").insert(batch);
        if (batchErr) throw batchErr;
      }

      toast({ title: "Lista importada com sucesso!", description: `${parsedContacts.length} contatos salvos` });
      setImportOpen(false);
      resetForm();
      onRefresh();
    } catch (err: any) {
      toast({ title: "Erro ao salvar lista", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleViewList(list: EmailList) {
    setDetailList(list);
    setLoadingDetail(true);
    const { data } = await supabase
      .from("email_contatos")
      .select("*")
      .eq("lista_id", list.id)
      .order("created_at", { ascending: true })
      .limit(200);
    setDetailContatos(data || []);
    setLoadingDetail(false);
  }

  async function handleDeleteList(listId: string) {
    const { error } = await supabase.from("email_lists").delete().eq("id", listId);
    if (error) {
      toast({ title: "Erro ao excluir lista", variant: "destructive" });
    } else {
      toast({ title: "Lista excluída" });
      onRefresh();
    }
  }

  function getNichoLabel(nicho: string) {
    return NICHOS.find(n => n.value === nicho)?.label || nicho;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "importada": return "bg-muted text-muted-foreground";
      case "em_abordagem": return "bg-primary/20 text-primary";
      case "concluida": return "bg-success/20 text-success";
      default: return "bg-muted text-muted-foreground";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setImportOpen(true); }} className="gap-1.5">
          <Upload className="h-4 w-4" /> Importar Lista
        </Button>
      </div>

      {listas.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma lista importada ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Importe uma planilha ou PDF com contatos para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listas.map(list => {
            const progress = list.total_emails > 0 ? (list.emails_enviados / list.total_emails) * 100 : 0;
            return (
              <Card key={list.id} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">{list.nome}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{getNichoLabel(list.nicho)}</Badge>
                        <Badge className={`text-[10px] ${getStatusColor(list.status)}`}>{list.status}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewList(list)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteList(list.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold">{list.total_emails}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{list.emails_enviados}</p>
                      <p className="text-[10px] text-muted-foreground">Enviados</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{list.emails_respondidos}</p>
                      <p className="text-[10px] text-muted-foreground">Respondidos</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Progresso</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Lista de Emails</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arquivo (.csv, .xlsx, .xls, .docx, .doc, .pdf)</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.docx,.doc,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {parsing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Processando arquivo...</span>
                  </div>
                ) : fileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <span className="text-sm">{fileName}</span>
                    <Badge className="bg-primary/20 text-primary text-[10px]">{parsedContacts.length} contatos</Badge>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste um arquivo</p>
                    <p className="text-xs text-muted-foreground mt-1">CSV, XLSX, XLS, DOCX, DOC ou PDF</p>
                  </div>
                )}
              </div>
            </div>

            {/* Column mapping (spreadsheets only) */}
            {availableColumns.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Mapeamento de Colunas (auto-detectado)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["email", "nome", "empresa", "cargo", "telefone"] as const).map(field => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-xs w-16 text-muted-foreground capitalize">{field}:</span>
                      <Select
                        value={columnMap[field] || "none"}
                        onValueChange={(v) => setColumnMap(prev => ({ ...prev, [field]: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Não mapear —</SelectItem>
                          {availableColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {parsedContacts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preview (primeiros 5 contatos)</Label>
                <div className="rounded border border-border overflow-auto max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Empresa</TableHead>
                        <TableHead className="text-xs">Cargo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedContacts.slice(0, 5).map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{c.nome || "—"}</TableCell>
                          <TableCell className="text-xs">{c.email}</TableCell>
                          <TableCell className="text-xs">{c.empresa || "—"}</TableCell>
                          <TableCell className="text-xs">{c.cargo || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Lista</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Clínicas SP - Março 2026" />
              </div>
              <div className="space-y-2">
                <Label>Nicho</Label>
                <Select value={nicho || "none"} onValueChange={(v) => setNicho(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {NICHOS.map(n => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {nicho === "outro" && (
                  <Input value={nichoCustom} onChange={e => setNichoCustom(e.target.value)} placeholder="Nome do nicho" className="mt-1" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes sobre esta lista..." />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveList} disabled={saving || parsedContacts.length === 0} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Salvando..." : `Importar ${parsedContacts.length} contatos`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailList} onOpenChange={(v) => { if (!v) setDetailList(null); }}>
        <DialogContent className="sm:max-w-3xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailList?.nome}</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded border border-border overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Empresa</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailContatos.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{c.nome || "—"}</TableCell>
                      <TableCell className="text-xs">{c.email}</TableCell>
                      <TableCell className="text-xs">{c.empresa || "—"}</TableCell>
                      <TableCell>
                        <Badge className="text-[10px] bg-muted text-muted-foreground">{c.status_envio}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { NICHOS };
