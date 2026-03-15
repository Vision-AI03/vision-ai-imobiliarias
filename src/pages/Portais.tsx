import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy, Check, RefreshCw, Loader2, Link2,
  Download, ArrowRight, Info, Upload, FileSpreadsheet, X,
} from "lucide-react";
import { useRef } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConfigPortal {
  id?: string;
  user_id?: string;
  portal: string;
  ativo: boolean;
  webhook_url?: string;
  feed_url?: string;
  total_leads_importados: number;
  ultima_sincronizacao?: string;
}

const PORTAIS_SUPORTADOS = [
  {
    key: "zap",
    nome: "ZAP Imóveis",
    cor: "#FF6B00",
    descricao: "Portal líder em imóveis no Brasil",
    instrucoes: "No painel ZAP Imóveis: Configurações > Integrações > Webhook de Leads. Cole a URL acima.",
  },
  {
    key: "vivareal",
    nome: "Viva Real",
    cor: "#00B37E",
    descricao: "Alto volume de buscas orgânicas",
    instrucoes: "No painel Viva Real: Ferramentas > Webhook de Leads. Cole a URL acima.",
  },
  {
    key: "olx",
    nome: "OLX Pro",
    cor: "#6E0AD6",
    descricao: "Maior classificado do Brasil",
    instrucoes: "No painel OLX Pro: Integrações > API de Leads. Cole a URL acima.",
  },
  {
    key: "imovelweb",
    nome: "ImovelWeb",
    cor: "#E30613",
    descricao: "Forte presença no Sul e Sudeste",
    instrucoes: "No painel ImovelWeb: Minha Conta > Integrações > Webhook URL. Cole a URL acima.",
  },
  {
    key: "123i",
    nome: "123I",
    cor: "#0057B8",
    descricao: "Custo-benefício competitivo",
    instrucoes: "No painel 123I: Configurações > Webhook de Leads. Cole a URL acima.",
  },
];

export default function Portais() {
  const [configs, setConfigs] = useState<Record<string, ConfigPortal>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editPortal, setEditPortal] = useState<string | null>(null);
  const [editFeedUrl, setEditFeedUrl] = useState("");
  const [xmlDialog, setXmlDialog] = useState<string | null>(null);
  const [xmlContent, setXmlContent] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [projectRef, setProjectRef] = useState<string>("");
  const [csvDialog, setCsvDialog] = useState(false);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvImporting, setCsvImporting] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Extract project ref from Supabase URL for webhook display
    const supabaseAny = supabase as any;
    const url: string = supabaseAny.supabaseUrl || supabaseAny.rest?.url || "";
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) setProjectRef(match[1]);

    const { data } = await supabase
      .from("config_portais")
      .select("*")
      .eq("user_id", user.id);

    const map: Record<string, ConfigPortal> = {};
    for (const p of PORTAIS_SUPORTADOS) {
      const existing = (data || []).find((d: any) => d.portal === p.key);
      map[p.key] = existing || {
        portal: p.key,
        ativo: false,
        total_leads_importados: 0,
      };
    }
    setConfigs(map);
    setLoading(false);
  }

  function webhookUrl(portalKey: string) {
    if (!projectRef) return "Configure credenciais do Supabase primeiro";
    return `https://${projectRef}.supabase.co/functions/v1/import-leads-portais?portal=${portalKey}&user=${userId || ""}`;
  }

  async function handleToggle(portalKey: string, ativo: boolean) {
    setSaving(portalKey);
    const config = configs[portalKey];
    try {
      if (config.id) {
        await supabase.from("config_portais").update({ ativo }).eq("id", config.id);
        setConfigs(prev => ({ ...prev, [portalKey]: { ...prev[portalKey], ativo } }));
      } else {
        const { data } = await supabase
          .from("config_portais")
          .insert({ user_id: userId, portal: portalKey, ativo, total_leads_importados: 0 })
          .select()
          .single();
        setConfigs(prev => ({ ...prev, [portalKey]: { ...prev[portalKey], ...(data || {}), ativo } }));
      }
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveFeedUrl() {
    if (!editPortal) return;
    setSaving(editPortal);
    const config = configs[editPortal];
    try {
      if (config.id) {
        await supabase.from("config_portais").update({ feed_url: editFeedUrl }).eq("id", config.id);
      } else {
        const { data } = await supabase
          .from("config_portais")
          .insert({ user_id: userId, portal: editPortal, ativo: config.ativo, feed_url: editFeedUrl, total_leads_importados: 0 })
          .select()
          .single();
        setConfigs(prev => ({ ...prev, [editPortal]: { ...prev[editPortal], ...(data || {}) } }));
        setSaving(null);
        setEditPortal(null);
        return;
      }
      setConfigs(prev => ({ ...prev, [editPortal]: { ...prev[editPortal], feed_url: editFeedUrl } }));
      toast({ title: "Configuração salva!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
      setEditPortal(null);
    }
  }

  async function handleImportXml(portalKey: string) {
    if (!xmlContent.trim()) {
      toast({ title: "Cole o XML antes de importar", variant: "destructive" });
      return;
    }
    setImporting(portalKey);
    try {
      const { data, error } = await supabase.functions.invoke("import-leads-portais", {
        body: { portal: portalKey, user_id: userId, xml: xmlContent },
      });
      if (error) throw error;
      const count = (data as any)?.leads_importados ?? 0;
      toast({ title: `${count} lead(s) importado(s) com sucesso!` });
      setXmlDialog(null);
      setXmlContent("");
      await init();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(null);
    }
  }

  async function handleImportFeed(portalKey: string) {
    const config = configs[portalKey];
    if (!config.feed_url) {
      toast({ title: "Configure a URL do feed primeiro", variant: "destructive" });
      return;
    }
    setImporting(portalKey);
    try {
      const { data, error } = await supabase.functions.invoke("import-leads-portais", {
        body: { portal: portalKey, user_id: userId, feed_url: config.feed_url },
      });
      if (error) throw error;
      const count = (data as any)?.leads_importados ?? 0;
      toast({ title: `${count} lead(s) importado(s) do feed!` });
      await init();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(null);
    }
  }

  function copyWebhook(portalKey: string) {
    navigator.clipboard.writeText(webhookUrl(portalKey));
    setCopied(portalKey);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: "CSV inválido", description: "O arquivo deve ter pelo menos 2 linhas.", variant: "destructive" });
        return;
      }
      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(delimiter).map(h => h.replace(/^"|"$/g, "").trim());
      const rows = lines.slice(1).map(l => l.split(delimiter).map(v => v.replace(/^"|"$/g, "").trim()));
      setCsvHeaders(headers);
      setCsvRows(rows);
      // Auto-map common column names
      const autoMap: Record<string, string> = {};
      const MAPPINGS: Record<string, string> = {
        nome: "nome", name: "nome", "nome completo": "nome",
        email: "email", "e-mail": "email",
        telefone: "telefone", phone: "telefone", celular: "telefone", whatsapp: "telefone",
        mensagem: "mensagem_original", message: "mensagem_original", observacao: "mensagem_original",
      };
      for (const h of headers) {
        const key = h.toLowerCase();
        if (MAPPINGS[key]) autoMap[h] = MAPPINGS[key];
      }
      setCsvMapping(autoMap);
      setCsvDialog(true);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  async function handleCsvImport() {
    if (!csvRows.length) return;
    const nomeCol = Object.keys(csvMapping).find(k => csvMapping[k] === "nome");
    if (!nomeCol) {
      toast({ title: "Mapeie a coluna Nome antes de importar", variant: "destructive" });
      return;
    }
    setCsvImporting(true);
    try {
      const leads = csvRows
        .filter(row => row[csvHeaders.indexOf(nomeCol)]?.trim())
        .map(row => {
          const entry: Record<string, any> = {
            status: "novo_lead",
            origem_portal: "manual",
            user_id: userId,
          };
          for (const [header, field] of Object.entries(csvMapping)) {
            const idx = csvHeaders.indexOf(header);
            const val = row[idx]?.trim();
            if (val && field) entry[field] = val;
          }
          return entry;
        });

      if (leads.length === 0) {
        toast({ title: "Nenhuma linha válida encontrada", variant: "destructive" });
        setCsvImporting(false);
        return;
      }

      // Insert in batches of 50
      let imported = 0;
      for (let i = 0; i < leads.length; i += 50) {
        const batch = leads.slice(i, i + 50);
        const { error } = await supabase.from("leads").insert(batch as any);
        if (!error) imported += batch.length;
      }

      toast({ title: `${imported} lead(s) importado(s) com sucesso!` });
      setCsvDialog(false);
      setCsvRows([]);
      setCsvHeaders([]);
      setCsvMapping({});
    } catch (err: any) {
      toast({ title: "Erro ao importar CSV", description: err.message, variant: "destructive" });
    } finally {
      setCsvImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalLeads = Object.values(configs).reduce((s, c) => s + (c.total_leads_importados || 0), 0);
  const portaisAtivos = Object.values(configs).filter(c => c.ativo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portais Imobiliários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Integre com os principais portais e importe leads automaticamente
          </p>
        </div>
        <div className="flex gap-4 items-center text-sm">
          <div className="text-center">
            <p className="text-xl font-bold text-primary">{portaisAtivos}</p>
            <p className="text-xs text-muted-foreground">ativos</p>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-center">
            <p className="text-xl font-bold">{totalLeads}</p>
            <p className="text-xs text-muted-foreground">leads importados</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex gap-3 items-start">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Ative cada portal e copie a <strong className="text-foreground">URL do Webhook</strong> para cadastrar no painel do portal.</p>
            <p>Leads chegam automaticamente e são criados no CRM com a origem identificada.</p>
            <p>Prefere importar manualmente? Use o botão <strong className="text-foreground">Importar XML</strong> com o arquivo exportado pelo portal.</p>
          </div>
        </CardContent>
      </Card>

      {/* Portal Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PORTAIS_SUPORTADOS.map(portal => {
          const config = configs[portal.key];
          const isActive = config?.ativo;
          const isSaving = saving === portal.key;
          const isImporting = importing === portal.key;

          return (
            <Card
              key={portal.key}
              className={`bg-card transition-colors ${isActive ? "border-primary/30" : "border-border"}`}
            >
              <CardHeader className="pb-3 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: portal.cor }}
                    >
                      {portal.nome.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold leading-none">{portal.nome}</CardTitle>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{portal.descricao}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <Badge className="bg-green-500/20 text-green-600 border-green-500/20 text-[10px] hidden sm:flex">
                        Ativo
                      </Badge>
                    )}
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={isActive}
                        onCheckedChange={(v) => handleToggle(portal.key, v)}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-5 pb-4 space-y-3">
                {/* Stats */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground">{config?.total_leads_importados || 0}</span> leads
                  </span>
                  {config?.ultima_sincronizacao && (
                    <span>
                      Sync: {format(new Date(config.ultima_sincronizacao), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>

                {isActive && (
                  <>
                    <Separator />

                    {/* Webhook URL */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={webhookUrl(portal.key)}
                          className="text-[10px] h-8 bg-muted/30 font-mono"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          onClick={() => copyWebhook(portal.key)}
                        >
                          {copied === portal.key ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Feed URL */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Feed XML (opcional)</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={config?.feed_url || ""}
                          className="text-xs h-8 bg-muted/30"
                          placeholder="URL do feed XML"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          onClick={() => {
                            setEditFeedUrl(config?.feed_url || "");
                            setEditPortal(portal.key);
                          }}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      {config?.feed_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1"
                          disabled={isImporting}
                          onClick={() => handleImportFeed(portal.key)}
                        >
                          {isImporting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Importar Feed
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={() => { setXmlContent(""); setXmlDialog(portal.key); }}
                      >
                        <Download className="h-3 w-3" />
                        Importar XML
                      </Button>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {portal.instrucoes}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CSV Import Card */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Importação via CSV / Excel</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Importe leads de qualquer planilha. Mapeie as colunas antes de importar.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => csvFileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Selecionar arquivo CSV
          </Button>
          <input ref={csvFileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvFile} />
        </CardContent>
      </Card>

      {/* CSV Mapping Dialog */}
      <Dialog open={csvDialog} onOpenChange={(v) => { if (!v) { setCsvDialog(false); setCsvRows([]); setCsvHeaders([]); setCsvMapping({}); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mapeamento de Colunas CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {csvRows.length} linha(s) detectada(s). Mapeie as colunas do CSV para os campos do sistema.
            </p>
            <div className="space-y-2">
              {csvHeaders.map(header => (
                <div key={header} className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded w-40 truncate shrink-0">{header}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <Select
                    value={csvMapping[header] || "__ignorar"}
                    onValueChange={(v) => setCsvMapping(prev => ({ ...prev, [header]: v === "__ignorar" ? "" : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignorar">— Ignorar —</SelectItem>
                      <SelectItem value="nome">Nome *</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="mensagem_original">Mensagem / Observação</SelectItem>
                      <SelectItem value="tipo_interesse">Tipo de Interesse</SelectItem>
                      <SelectItem value="tipo_imovel">Tipo de Imóvel</SelectItem>
                      <SelectItem value="bairro_interesse">Bairro de Interesse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {/* Preview */}
            {csvRows.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Prévia (3 primeiras linhas)</p>
                <div className="rounded border border-border overflow-x-auto">
                  <table className="text-[10px] w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        {csvHeaders.map(h => (
                          <th key={h} className="px-2 py-1 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1 truncate max-w-[100px]">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCsvDialog(false); setCsvRows([]); setCsvHeaders([]); setCsvMapping({}); }}>
              Cancelar
            </Button>
            <Button size="sm" disabled={csvImporting} onClick={handleCsvImport}>
              {csvImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              {csvImporting ? "Importando..." : `Importar ${csvRows.length} leads`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Feed URL Dialog */}
      <Dialog open={!!editPortal} onOpenChange={() => setEditPortal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Configurar Feed — {PORTAIS_SUPORTADOS.find(p => p.key === editPortal)?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-sm">URL do Feed XML de Leads</Label>
            <Input
              placeholder="https://portal.com.br/feeds/meus-leads.xml"
              value={editFeedUrl}
              onChange={e => setEditFeedUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Alguns portais disponibilizam um endpoint XML onde você pode buscar leads periodicamente.
              Use "Importar Feed" para sincronizar manualmente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditPortal(null)}>Cancelar</Button>
            <Button size="sm" disabled={saving === editPortal} onClick={handleSaveFeedUrl}>
              {saving === editPortal && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* XML Import Dialog */}
      <Dialog open={!!xmlDialog} onOpenChange={() => setXmlDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Importar XML — {PORTAIS_SUPORTADOS.find(p => p.key === xmlDialog)?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Cole o XML exportado pelo portal. Os leads serão criados no CRM com origem{" "}
              <strong className="text-foreground">"{xmlDialog}"</strong>.
            </p>
            <Textarea
              placeholder={`<?xml version="1.0" encoding="UTF-8"?>\n<leads>\n  <lead>\n    <nome>João Silva</nome>\n    <telefone>11999998888</telefone>\n    <email>joao@email.com</email>\n    <mensagem>Interesse no apartamento 3 quartos</mensagem>\n  </lead>\n</leads>`}
              value={xmlContent}
              onChange={e => setXmlContent(e.target.value)}
              className="font-mono text-xs min-h-[180px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setXmlDialog(null)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={importing === xmlDialog}
              onClick={() => xmlDialog && handleImportXml(xmlDialog)}
            >
              {importing === xmlDialog ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
              )}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
