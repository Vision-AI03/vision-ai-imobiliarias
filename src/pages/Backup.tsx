import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, ShieldAlert, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { format } from "date-fns";

type ExportFormat = "csv" | "json";

interface ExportableTable {
  id: string;
  label: string;
  description: string;
  fetch: () => Promise<Record<string, unknown>[]>;
  filename: string;
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      const str = val === null || val === undefined ? "" : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export default function Backup() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formatType, setFormatType] = useState<ExportFormat>("csv");
  const [exporting, setExporting] = useState(false);

  const tables: ExportableTable[] = [
    {
      id: "leads",
      label: "Leads",
      description: "Todos os leads do CRM",
      filename: "leads",
      fetch: async () => {
        const { data } = await supabase.from("leads").select("*");
        return (data || []) as Record<string, unknown>[];
      },
    },
    {
      id: "comunicacoes",
      label: "Comunicações",
      description: "comunicacoes + email_contatos",
      filename: "comunicacoes",
      fetch: async () => {
        const [r1, r2] = await Promise.all([
          supabase.from("comunicacoes").select("*"),
          supabase.from("email_contatos").select("*"),
        ]);
        return [
          ...((r1.data || []) as Record<string, unknown>[]),
          ...((r2.data || []) as Record<string, unknown>[]),
        ];
      },
    },
    {
      id: "contratos",
      label: "Contratos",
      description: "contratos + contratos_gerados",
      filename: "contratos",
      fetch: async () => {
        const [r1, r2] = await Promise.all([
          supabase.from("contratos").select("*"),
          supabase.from("contratos_gerados").select("*"),
        ]);
        return [
          ...((r1.data || []) as Record<string, unknown>[]),
          ...((r2.data || []) as Record<string, unknown>[]),
        ];
      },
    },
    {
      id: "tarefas",
      label: "Tarefas",
      description: "Todas as tarefas",
      filename: "tarefas",
      fetch: async () => {
        const { data } = await supabase.from("tarefas").select("*");
        return (data || []) as Record<string, unknown>[];
      },
    },
    {
      id: "financeiro_empresa",
      label: "Financeiro — Empresa",
      description: "parcelas + recorrencias + custos empresa",
      filename: "financeiro_empresa",
      fetch: async () => {
        const [r1, r2, r3] = await Promise.all([
          supabase.from("parcelas").select("*"),
          supabase.from("recorrencias").select("*"),
          supabase.from("custos").select("*").or("escopo.eq.empresa,escopo.is.null"),
        ]);
        return [
          ...((r1.data || []) as Record<string, unknown>[]),
          ...((r2.data || []) as Record<string, unknown>[]),
          ...((r3.data || []) as Record<string, unknown>[]),
        ];
      },
    },
    {
      id: "financeiro_pessoal",
      label: "Financeiro — Pessoal",
      description: "transacoes_pessoais + custos pessoal",
      filename: "financeiro_pessoal",
      fetch: async () => {
        const [r1, r2] = await Promise.all([
          supabase.from("transacoes_pessoais").select("*"),
          supabase.from("custos").select("*").eq("escopo", "pessoal"),
        ]);
        return [
          ...((r1.data || []) as Record<string, unknown>[]),
          ...((r2.data || []) as Record<string, unknown>[]),
        ];
      },
    },
    {
      id: "credenciais",
      label: "Credenciais",
      description: "Todos os dados incluindo valores das chaves",
      filename: "credenciais",
      fetch: async () => {
        const { data } = await supabase
          .from("credentials")
          .select("*");
        return (data || []) as Record<string, unknown>[];
      },
    },
  ];

  const toggleItem = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(tables.map(t => t.id)));

  const handleExport = async (items: Set<string>) => {
    if (items.size === 0) {
      toast({ title: "Selecione ao menos uma tabela", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      const toExport = tables.filter(t => items.has(t.id));

      const results = await Promise.all(toExport.map(async t => ({
        filename: t.filename,
        data: await t.fetch(),
      })));

      for (const { filename, data } of results) {
        if (data.length === 0) continue;
        const ext = formatType === "csv" ? "csv" : "json";
        const content = formatType === "csv"
          ? convertToCSV(data)
          : JSON.stringify(data, null, 2);
        zip.file(`${filename}.${ext}`, content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const dateStr = format(new Date(), "yyyy-MM-dd");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-visionai-${dateStr}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Backup exportado com sucesso!" });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao exportar", description: String(err), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exportação / Backup de Dados</h1>
        <p className="text-muted-foreground">Exporte seus dados em CSV ou JSON para backup ou análise externa.</p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          As credenciais são exportadas <strong>sem os valores das chaves</strong> por segurança. Apenas nomes, serviços e datas de expiração são incluídos.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tabelas para exportar</CardTitle>
          <CardDescription>Selecione quais dados deseja incluir no backup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tables.map(t => (
            <div key={t.id} className="flex items-start gap-3">
              <Checkbox
                id={t.id}
                checked={selected.has(t.id)}
                onCheckedChange={() => toggleItem(t.id)}
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor={t.id} className="font-medium cursor-pointer">{t.label}</Label>
                <span className="text-xs text-muted-foreground">{t.description}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${formatType === "csv" ? "text-foreground" : "text-muted-foreground"}`}>CSV</span>
              <Switch
                checked={formatType === "json"}
                onCheckedChange={(v) => setFormatType(v ? "json" : "csv")}
              />
              <span className={`text-sm font-medium ${formatType === "json" ? "text-foreground" : "text-muted-foreground"}`}>JSON</span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { selectAll(); handleExport(new Set(tables.map(t => t.id))); }}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar Tudo
              </Button>
              <Button onClick={() => handleExport(selected)} disabled={exporting || selected.size === 0}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar Selecionados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
