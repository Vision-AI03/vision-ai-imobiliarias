import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, Send, Loader2, Eye, RefreshCw, CheckCheck, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailList {
  id: string;
  nome: string;
  nicho: string;
  total_emails: number;
  emails_enviados: number;
}

interface Template {
  id: string;
  nicho: string;
  nome: string;
  prompt_ia: string;
  assunto_base: string | null;
}

interface Contato {
  id: string;
  nome: string | null;
  email: string;
  empresa: string | null;
  cargo: string | null;
  email_gerado: string | null;
  email_assunto: string | null;
  status_envio: string;
}

interface Props {
  listas: EmailList[];
  templates: Template[];
  onRefresh: () => void;
}

export function GerarEnviarTab({ listas, templates, onRefresh }: Props) {
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewContato, setPreviewContato] = useState<Contato | null>(null);
  const [editAssunto, setEditAssunto] = useState("");
  const [editConteudo, setEditConteudo] = useState("");
  const { toast } = useToast();

  const selectedList = listas.find(l => l.id === selectedListId);
  const filteredTemplates = selectedList
    ? templates.filter(t => t.nicho === selectedList.nicho)
    : templates;

  useEffect(() => {
    if (selectedListId) {
      loadContatos();
    } else {
      setContatos([]);
    }
  }, [selectedListId]);

  async function loadContatos() {
    setLoadingContatos(true);
    const { data } = await supabase
      .from("email_contatos")
      .select("id, nome, email, empresa, cargo, email_gerado, email_assunto, status_envio")
      .eq("lista_id", selectedListId)
      .order("created_at");
    setContatos((data as Contato[]) || []);
    setLoadingContatos(false);
  }

  async function handleGenerateAll() {
    if (!selectedTemplateId) {
      toast({ title: "Selecione um template", variant: "destructive" });
      return;
    }

    const pendentes = contatos.filter(c => c.status_envio === "pendente");
    if (pendentes.length === 0) {
      toast({ title: "Nenhum contato pendente para gerar", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setGenProgress({ done: 0, total: pendentes.length });

    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < pendentes.length; i += batchSize) {
      const batch = pendentes.slice(i, i + batchSize);
      const { data, error } = await supabase.functions.invoke("generate-niche-emails", {
        body: {
          contato_ids: batch.map(c => c.id),
          template_id: selectedTemplateId,
        },
      });

      if (error) {
        toast({ title: "Erro na geração", description: error.message, variant: "destructive" });
        break;
      }

      setGenProgress(prev => ({ ...prev, done: Math.min(i + batchSize, pendentes.length) }));
    }

    setGenerating(false);
    toast({ title: "Geração concluída!" });
    loadContatos();
  }

  async function handleSendSelected() {
    const toSend = contatos.filter(c => selectedIds.has(c.id) && c.status_envio === "gerado");
    if (toSend.length === 0) {
      toast({ title: "Selecione contatos com email gerado", variant: "destructive" });
      return;
    }

    setSending(true);
    setSendProgress({ done: 0, total: toSend.length });

    const { data, error } = await supabase.functions.invoke("send-niche-emails", {
      body: { contato_ids: toSend.map(c => c.id) },
    });

    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      const results = data?.results || [];
      const successes = results.filter((r: any) => r.success).length;
      toast({ title: `${successes}/${toSend.length} emails enviados!` });
    }

    setSending(false);
    setSelectedIds(new Set());
    loadContatos();
    onRefresh();
  }

  function toggleSelectAll() {
    const gerados = contatos.filter(c => c.status_envio === "gerado");
    if (selectedIds.size === gerados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(gerados.map(c => c.id)));
    }
  }

  function handlePreview(c: Contato) {
    setPreviewContato(c);
    setEditAssunto(c.email_assunto || "");
    setEditConteudo(c.email_gerado || "");
  }

  async function handleSaveEdit() {
    if (!previewContato) return;
    await supabase
      .from("email_contatos")
      .update({ email_assunto: editAssunto, email_gerado: editConteudo })
      .eq("id", previewContato.id);
    toast({ title: "Email atualizado" });
    setPreviewContato(null);
    loadContatos();
  }

  async function handleRegenerate(contatoId: string) {
    if (!selectedTemplateId) {
      toast({ title: "Selecione um template", variant: "destructive" });
      return;
    }

    // Reset to pendente first
    await supabase.from("email_contatos").update({ status_envio: "pendente", email_gerado: null, email_assunto: null }).eq("id", contatoId);

    const { error } = await supabase.functions.invoke("generate-niche-emails", {
      body: { contato_ids: [contatoId], template_id: selectedTemplateId },
    });

    if (error) {
      toast({ title: "Erro ao regenerar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email regenerado!" });
    }
    loadContatos();
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "pendente": return "bg-muted text-muted-foreground";
      case "gerado": return "bg-accent/20 text-accent-foreground";
      case "enviado": return "bg-primary/20 text-primary";
      case "aberto": return "bg-success/20 text-success";
      case "respondido": return "bg-success/30 text-success";
      case "erro": return "bg-destructive/20 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  }

  const geradosCount = contatos.filter(c => c.status_envio === "gerado").length;
  const enviadosCount = contatos.filter(c => c.status_envio === "enviado").length;
  const pendentesCount = contatos.filter(c => c.status_envio === "pendente").length;

  return (
    <div className="space-y-4">
      {/* Step 1: Select List & Template */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1. Selecionar Lista e Template</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Lista de Emails</Label>
              <Select value={selectedListId || "none"} onValueChange={(v) => setSelectedListId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione uma lista..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {listas.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome} ({l.total_emails} contatos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Template de Nicho</Label>
              <Select value={selectedTemplateId || "none"} onValueChange={(v) => setSelectedTemplateId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione um template..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {filteredTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Generate */}
      {selectedListId && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">2. Gerar Emails com IA</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{pendentesCount} pendentes</span>
                <span>•</span>
                <span>{geradosCount} gerados</span>
                <span>•</span>
                <span>{enviadosCount} enviados</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {generating && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gerando emails...</span>
                  <span>{genProgress.done}/{genProgress.total}</span>
                </div>
                <Progress value={(genProgress.done / genProgress.total) * 100} className="h-2" />
              </div>
            )}
            <Button
              onClick={handleGenerateAll}
              disabled={generating || !selectedTemplateId || pendentesCount === 0}
              className="gap-1.5"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Gerando..." : `Gerar Emails (${pendentesCount} pendentes)`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Send */}
      {contatos.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">3. Revisar e Enviar</CardTitle>
              <div className="flex items-center gap-2">
                {geradosCount > 0 && (
                  <Button variant="outline" size="sm" onClick={toggleSelectAll} className="text-xs gap-1">
                    <CheckCheck className="h-3 w-3" />
                    {selectedIds.size === geradosCount ? "Desmarcar Todos" : "Selecionar Todos Gerados"}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSendSelected}
                  disabled={sending || selectedIds.size === 0}
                  className="gap-1.5 text-xs"
                >
                  {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  {sending ? "Enviando..." : `Enviar Selecionados (${selectedIds.size})`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sending && (
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Enviando emails...</span>
                  <span>{sendProgress.done}/{sendProgress.total}</span>
                </div>
                <Progress value={sendProgress.total > 0 ? (sendProgress.done / sendProgress.total) * 100 : 0} className="h-2" />
              </div>
            )}

            {loadingContatos ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded border border-border overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Assunto Gerado</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contatos.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          {c.status_envio === "gerado" && (
                            <Checkbox
                              checked={selectedIds.has(c.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedIds);
                                if (checked) next.add(c.id); else next.delete(c.id);
                                setSelectedIds(next);
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{c.nome || "—"}</TableCell>
                        <TableCell className="text-xs">{c.email}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {c.email_assunto || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${getStatusColor(c.status_envio)}`}>
                            {c.status_envio}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.email_gerado && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handlePreview(c)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            )}
                            {(c.status_envio === "gerado" || c.status_envio === "pendente") && selectedTemplateId && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRegenerate(c.id)}>
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview/Edit Dialog */}
      <Dialog open={!!previewContato} onOpenChange={(v) => { if (!v) setPreviewContato(null); }}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email para {previewContato?.nome || previewContato?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input value={editAssunto} onChange={e => setEditAssunto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea value={editConteudo} onChange={e => setEditConteudo(e.target.value)} className="min-h-[200px]" />
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-primary p-4">
                  <span className="text-primary-foreground font-bold text-lg">Vision AI</span>
                </div>
                <div className="bg-card p-4 space-y-2">
                  <h3 className="font-semibold">{editAssunto || "Sem assunto"}</h3>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{editConteudo || "..."}</div>
                </div>
                <div className="bg-secondary/30 px-4 py-3 text-[10px] text-muted-foreground text-center">
                  Vision AI — Inteligência Artificial para o seu negócio
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewContato(null)}>Cancelar</Button>
              <Button onClick={handleSaveEdit}>Salvar Alterações</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
