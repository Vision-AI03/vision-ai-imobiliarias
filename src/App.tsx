import { useEffect, useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { AppLayout } from "@/components/AppLayout";
import { PlataformaProvider } from "@/contexts/PlataformaContext";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CRM = lazy(() => import("./pages/CRM"));
const Comunicacoes = lazy(() => import("./pages/Comunicacoes"));
const Contratos = lazy(() => import("./pages/Contratos"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Credenciais = lazy(() => import("./pages/Credenciais"));
const Integracoes = lazy(() => import("./pages/Integracoes"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Backup = lazy(() => import("./pages/Backup"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Imoveis = lazy(() => import("./pages/Imoveis"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Corretores = lazy(() => import("./pages/Corretores"));
const Aparencia = lazy(() => import("./pages/Aparencia"));
const Portais = lazy(() => import("./pages/Portais"));
const HotsiteCorretor = lazy(() => import("./pages/HotsiteCorretor"));
const Simulador = lazy(() => import("./pages/Simulador"));

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

  if (!session) {
    return <Auth />;
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
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
          <Route path="/simulador" element={<Simulador />} />
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
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PlataformaProvider>
          <AppRoutes />
        </PlataformaProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
