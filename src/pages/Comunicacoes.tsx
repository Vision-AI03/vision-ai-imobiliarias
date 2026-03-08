import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, FileText, Sparkles, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListasTab } from "@/components/comunicacoes/ListasTab";
import { TemplatesNichoTab } from "@/components/comunicacoes/TemplatesNichoTab";
import { GerarEnviarTab } from "@/components/comunicacoes/GerarEnviarTab";

export default function Comunicacoes() {
  const [listas, setListas] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [listasRes, templatesRes] = await Promise.all([
      supabase.from("email_lists").select("*").order("created_at", { ascending: false }),
      supabase.from("email_templates_nicho").select("*").order("created_at", { ascending: false }),
    ]);
    setListas(listasRes.data || []);
    setTemplates(templatesRes.data || []);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comunicações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe listas, gere emails com IA por nicho e envie via Resend
          </p>
        </div>
      </div>

      <Tabs defaultValue="listas" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="listas" className="gap-1.5">
            <List className="h-4 w-4" /> Listas de Email
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-4 w-4" /> Templates por Nicho
          </TabsTrigger>
          <TabsTrigger value="gerar" className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Gerar & Enviar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listas">
          <ListasTab listas={listas} onRefresh={fetchAll} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesNichoTab templates={templates} onRefresh={fetchAll} />
        </TabsContent>

        <TabsContent value="gerar">
          <GerarEnviarTab listas={listas} templates={templates} onRefresh={fetchAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
