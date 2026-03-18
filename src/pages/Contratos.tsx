import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutTemplate, MessageSquareText, Files, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TemplatesTab from "@/components/contratos/TemplatesTab";
import GerarContratoTab from "@/components/contratos/GerarContratoTab";
import ContratosGeradosTab from "@/components/contratos/ContratosGeradosTab";

export default function Contratos() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("modelos");
  const [templates, setTemplates] = useState<any[]>([]);
  const [contratosGerados, setContratosGerados] = useState<any[]>([]);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [tRes, gRes] = await Promise.all([
      supabase.from("contrato_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("contratos_gerados").select("*").order("created_at", { ascending: false }),
    ]);
    setTemplates((tRes.data as any[]) || []);
    setContratosGerados((gRes.data as any[]) || []);
    setLoading(false);
  }

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
        <h1 className="text-2xl font-bold">Propostas & Contratos</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie modelos, preencha com IA e acompanhe contratos gerados.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="modelos" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Modelos
            {templates.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{templates.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="gerar" className="gap-2">
            <MessageSquareText className="h-4 w-4" />
            Preencher com IA
          </TabsTrigger>
          <TabsTrigger value="gerados" className="gap-2">
            <Files className="h-4 w-4" />
            Gerados
            {contratosGerados.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{contratosGerados.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modelos">
          <TemplatesTab templates={templates} onRefresh={fetchAll} />
        </TabsContent>

        <TabsContent value="gerar">
          {templates.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum modelo cadastrado ainda.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Crie um modelo na aba "Modelos" antes de usar o Preencher com IA.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab("modelos")}
                >
                  Ir para Modelos
                </Button>
              </CardContent>
            </Card>
          ) : (
            <GerarContratoTab
              templates={templates}
              onContratoGerado={() => { fetchAll(); setActiveTab("gerados"); }}
            />
          )}
        </TabsContent>

        <TabsContent value="gerados">
          <ContratosGeradosTab
            contratos={contratosGerados}
            templates={templates}
            onRefresh={fetchAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
