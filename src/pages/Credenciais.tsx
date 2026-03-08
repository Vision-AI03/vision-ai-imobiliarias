import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, EyeOff, Copy, Search, KeyRound, AlertTriangle, Pencil, Trash2, CalendarIcon, Building2, Users } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const SERVICOS = [
  "Google Gemini", "OpenAI", "Anthropic Claude", "Resend", "Meta WhatsApp",
  "Firecrawl", "Apify", "Supabase", "Vercel", "Contabo", "Evolution API", "Outro",
];

const TIPOS = [
  { value: "api_key", label: "API Key" },
  { value: "token", label: "Token" },
  { value: "senha", label: "Senha" },
  { value: "oauth", label: "OAuth" },
  { value: "outro", label: "Outro" },
];

interface Credential {
  id: string;
  nome: string;
  servico: string;
  tipo: string;
  valor: string;
  url_servico: string | null;
  notas: string | null;
  ultimo_uso: string | null;
  expira_em: string | null;
  ativo: boolean;
  created_at: string;
  escopo: string;
}

const maskedValue = (val: string) => {
  if (val.length <= 4) return "••••";
  return "••••••••" + val.slice(-4);
};

export default function Credenciais() {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("vision_ai");

  // Form state
  const [nome, setNome] = useState("");
  const [servico, setServico] = useState("");
  const [tipo, setTipo] = useState("api_key");
  const [valor, setValor] = useState("");
  const [showValor, setShowValor] = useState(false);
  const [urlServico, setUrlServico] = useState("");
  const [expiraEm, setExpiraEm] = useState<Date | undefined>();
  const [notas, setNotas] = useState("");

  useEffect(() => { fetchCredentials(); }, []);

  async function fetchCredentials() {
    setLoading(true);
    const { data, error } = await supabase
      .from("credentials")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar credenciais", description: error.message, variant: "destructive" });
    } else {
      setCredentials((data as any[]) || []);
    }
    setLoading(false);
  }

  function resetForm() {
    setNome(""); setServico(""); setTipo("api_key"); setValor("");
    setShowValor(false); setUrlServico(""); setExpiraEm(undefined); setNotas("");
    setEditId(null);
  }

  function openEdit(cred: Credential) {
    setEditId(cred.id);
    setNome(cred.nome);
    setServico(cred.servico);
    setTipo(cred.tipo);
    setValor(cred.valor);
    setUrlServico(cred.url_servico || "");
    setExpiraEm(cred.expira_em ? new Date(cred.expira_em) : undefined);
    setNotas(cred.notas || "");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!nome.trim() || !servico || !valor.trim()) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload: any = {
      user_id: user.id,
      nome: nome.trim(),
      servico,
      tipo,
      valor: valor.trim(),
      url_servico: urlServico.trim() || null,
      expira_em: expiraEm ? expiraEm.toISOString() : null,
      notas: notas.trim() || null,
      escopo: activeTab,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("credentials").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("credentials").insert(payload));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "Credencial atualizada" : "Credencial criada" });
      setDialogOpen(false);
      resetForm();
      fetchCredentials();
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("credentials").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Credencial excluída" });
      fetchCredentials();
    }
    setDeleteId(null);
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    const { error } = await supabase.from("credentials").update({ ativo: !ativo }).eq("id", id);
    if (!error) fetchCredentials();
  }

  function toggleReveal(id: string) {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function copyToClipboard(val: string) {
    navigator.clipboard.writeText(val);
    toast({ title: "Copiado para a área de transferência" });
  }

  const filtered = useMemo(() => {
    const byScope = credentials.filter(c => c.escopo === activeTab);
    if (!search.trim()) return byScope;
    const q = search.toLowerCase();
    return byScope.filter(c =>
      c.nome.toLowerCase().includes(q) || c.servico.toLowerCase().includes(q)
    );
  }, [credentials, search, activeTab]);

  const visionCount = credentials.filter(c => c.escopo === "vision_ai").length;
  const clienteCount = credentials.filter(c => c.escopo === "cliente").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cofre de Credenciais</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas chaves de API, tokens e senhas de forma segura.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="vision_ai" className="gap-2">
              <Building2 className="h-4 w-4" />
              Vision AI
              {visionCount > 0 && <Badge variant="secondary" className="ml-1 text-xs">{visionCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="cliente" className="gap-2">
              <Users className="h-4 w-4" />
              Clientes
              {clienteCount > 0 && <Badge variant="secondary" className="ml-1 text-xs">{clienteCount}</Badge>}
            </TabsTrigger>
          </TabsList>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Credencial</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Credencial" : "Nova Credencial"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input placeholder="Ex: Gemini API Key" value={nome} onChange={e => setNome(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Serviço *</Label>
                    <Select value={servico} onValueChange={setServico}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {SERVICOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo *</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Valor *</Label>
                  <div className="relative">
                    <Input
                      type={showValor ? "text" : "password"}
                      placeholder="Cole a chave ou token aqui"
                      value={valor}
                      onChange={e => setValor(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowValor(!showValor)}
                    >
                      {showValor ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>URL do Serviço</Label>
                  <Input placeholder="https://aistudio.google.com" value={urlServico} onChange={e => setUrlServico(e.target.value)} />
                </div>
                <div>
                  <Label>Data de Expiração</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expiraEm && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expiraEm ? format(expiraEm, "dd/MM/yyyy", { locale: ptBR }) : "Sem expiração"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={expiraEm} onSelect={setExpiraEm} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Notas</Label>
                  <Textarea placeholder="Observações opcionais" value={notas} onChange={e => setNotas(e.target.value)} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleSave}>{editId ? "Salvar" : "Criar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar credenciais..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <TabsContent value="vision_ai">
          <CredentialsTable
            credentials={filtered}
            revealedIds={revealedIds}
            onToggleReveal={toggleReveal}
            onCopy={copyToClipboard}
            onToggleAtivo={toggleAtivo}
            onEdit={openEdit}
            onDelete={setDeleteId}
            emptyMessage="Nenhuma credencial da Vision AI cadastrada."
          />
        </TabsContent>

        <TabsContent value="cliente">
          <CredentialsTable
            credentials={filtered}
            revealedIds={revealedIds}
            onToggleReveal={toggleReveal}
            onCopy={copyToClipboard}
            onToggleAtivo={toggleAtivo}
            onEdit={openEdit}
            onDelete={setDeleteId}
            emptyMessage="Nenhuma credencial de clientes cadastrada."
          />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir credencial?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A credencial será removida permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Extracted table component
function CredentialsTable({
  credentials,
  revealedIds,
  onToggleReveal,
  onCopy,
  onToggleAtivo,
  onEdit,
  onDelete,
  emptyMessage,
}: {
  credentials: Credential[];
  revealedIds: Set<string>;
  onToggleReveal: (id: string) => void;
  onCopy: (val: string) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onEdit: (cred: Credential) => void;
  onDelete: (id: string) => void;
  emptyMessage: string;
}) {
  if (credentials.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <KeyRound className="h-12 w-12 mb-4 opacity-40" />
          <p>{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expiração</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credentials.map(cred => {
              const isRevealed = revealedIds.has(cred.id);
              const daysUntilExpiry = cred.expira_em ? differenceInDays(new Date(cred.expira_em), new Date()) : null;
              const expiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
              const expired = daysUntilExpiry !== null && daysUntilExpiry < 0;

              return (
                <TableRow key={cred.id}>
                  <TableCell className="font-medium">{cred.nome}</TableCell>
                  <TableCell>{cred.servico}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {TIPOS.find(t => t.value === cred.tipo)?.label || cred.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                        {isRevealed ? cred.valor : maskedValue(cred.valor)}
                      </code>
                      <button onClick={() => onToggleReveal(cred.id)} className="text-muted-foreground hover:text-foreground">
                        {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => onCopy(cred.valor)} className="text-muted-foreground hover:text-foreground">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cred.ativo ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}>
                      {cred.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {cred.expira_em ? (
                      <div className="flex items-center gap-1">
                        {(expiringSoon || expired) && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                        <span className={cn("text-xs", expired && "text-destructive", expiringSoon && "text-warning")}>
                          {format(new Date(cred.expira_em), "dd/MM/yyyy")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Switch checked={cred.ativo} onCheckedChange={() => onToggleAtivo(cred.id, cred.ativo)} className="mr-2" />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(cred)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(cred.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

const TIPOS_CONST = TIPOS;
