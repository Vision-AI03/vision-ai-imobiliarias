import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Comunicacoes from "./pages/Comunicacoes";
import Contratos from "./pages/Contratos";
import Financeiro from "./pages/Financeiro";
import Credenciais from "./pages/Credenciais";
import Integracoes from "./pages/Integracoes";
import Tarefas from "./pages/Tarefas";
import Backup from "./pages/Backup";
import Notificacoes from "./pages/Notificacoes";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";
// Novos módulos imobiliários
import Imoveis from "./pages/Imoveis";
import Agenda from "./pages/Agenda";
import Corretores from "./pages/Corretores";
import Aparencia from "./pages/Aparencia";
import Portais from "./pages/Portais";
import HotsiteCorretor from "./pages/HotsiteCorretor";

const queryClient = new QueryClient();

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // DEV: login desativado temporariamente para testes
  // if (!session) {
  //   return <Auth />;
  // }

  return (
    <Routes>
      {/* Rotas públicas — sem autenticação */}
      <Route path="/c/:slug" element={<HotsiteCorretor />} />

      <Route element={<AppLayout />}>
        {/* Core */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/comunicacoes" element={<Comunicacoes />} />
        <Route path="/contratos" element={<Contratos />} />
        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/tarefas" element={<Tarefas />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
        {/* Imobiliários novos */}
        <Route path="/imoveis" element={<Imoveis />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/corretores" element={<Corretores />} />
        {/* Configurações */}
        <Route path="/configuracoes/credenciais" element={<Credenciais />} />
        <Route path="/configuracoes/backup" element={<Backup />} />
        <Route path="/configuracoes/integracoes" element={<Integracoes />} />
        <Route path="/configuracoes/aparencia" element={<Aparencia />} />
        <Route path="/configuracoes/portais" element={<Portais />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
