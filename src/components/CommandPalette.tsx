import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Home, CheckSquare, User, LayoutDashboard, Calendar,
  FileText, BarChart2, Settings, Building2, Bell, Plug,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  id: string;
  type: "lead" | "imovel" | "tarefa" | "corretor";
  title: string;
  subtitle?: string;
  path: string;
}

const PAGES = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "CRM — Pipeline de Leads", path: "/crm", icon: Users },
  { title: "Imóveis", path: "/imoveis", icon: Home },
  { title: "Agenda", path: "/agenda", icon: Calendar },
  { title: "Tarefas", path: "/tarefas", icon: CheckSquare },
  { title: "Corretores", path: "/corretores", icon: User },
  { title: "Contratos", path: "/contratos", icon: FileText },
  { title: "Relatórios", path: "/relatorios", icon: BarChart2 },
  { title: "Portais", path: "/portais", icon: Plug },
  { title: "Notificações", path: "/notificacoes", icon: Bell },
  { title: "Aparência", path: "/aparencia", icon: Building2 },
  { title: "Configurações", path: "/configuracoes", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const pattern = `%${q}%`;

    const [leadsRes, imoveisRes, tarefasRes, corretoresRes] = await Promise.all([
      supabase.from("leads").select("id, nome, status, origem_portal").ilike("nome", pattern).limit(5),
      supabase.from("imoveis").select("id, titulo, endereco, bairro, status").ilike("titulo", pattern).limit(5),
      supabase.from("tarefas").select("id, titulo, status, concluida").ilike("titulo", pattern).eq("concluida", false).limit(5),
      supabase.from("corretores").select("id, nome, especialidade").ilike("nome", pattern).limit(4),
    ]);

    const found: SearchResult[] = [
      ...(leadsRes.data || []).map(l => ({
        id: l.id,
        type: "lead" as const,
        title: l.nome,
        subtitle: l.status?.replace(/_/g, " "),
        path: "/crm",
      })),
      ...(imoveisRes.data || []).map(i => ({
        id: i.id,
        type: "imovel" as const,
        title: i.titulo || i.endereco || "Imóvel",
        subtitle: [i.bairro, i.status].filter(Boolean).join(" · "),
        path: "/imoveis",
      })),
      ...(tarefasRes.data || []).map(t => ({
        id: t.id,
        type: "tarefa" as const,
        title: t.titulo,
        subtitle: t.status?.replace(/_/g, " "),
        path: "/tarefas",
      })),
      ...(corretoresRes.data || []).map(c => ({
        id: c.id,
        type: "corretor" as const,
        title: c.nome,
        subtitle: c.especialidade || undefined,
        path: "/corretores",
      })),
    ];

    setResults(found);
    setSearching(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 200);
    return () => clearTimeout(timeout);
  }, [query, search]);

  function handleSelect(path: string) {
    setOpen(false);
    setQuery("");
    navigate(path);
  }

  const typeIcon = {
    lead: <Users className="h-4 w-4 text-blue-500" />,
    imovel: <Home className="h-4 w-4 text-emerald-500" />,
    tarefa: <CheckSquare className="h-4 w-4 text-orange-500" />,
    corretor: <User className="h-4 w-4 text-purple-500" />,
  };

  const typeLabel = {
    lead: "Lead",
    imovel: "Imóvel",
    tarefa: "Tarefa",
    corretor: "Corretor",
  };

  const filteredPages = query.trim().length > 0
    ? PAGES.filter(p => p.title.toLowerCase().includes(query.toLowerCase()))
    : PAGES;

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <CommandInput
        placeholder="Buscar leads, imóveis, tarefas, páginas..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {searching && (
          <div className="py-4 text-center text-sm text-muted-foreground">Buscando...</div>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        )}

        {results.length > 0 && (
          <>
            <CommandGroup heading="Resultados">
              {results.map(r => (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  value={`${r.type}-${r.title}`}
                  onSelect={() => handleSelect(r.path)}
                  className="flex items-center gap-2.5"
                >
                  {typeIcon[r.type]}
                  <div className="flex-1 min-w-0">
                    <span className="truncate">{r.title}</span>
                    {r.subtitle && (
                      <span className="text-xs text-muted-foreground ml-2">{r.subtitle}</span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {typeLabel[r.type]}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navegar">
          {filteredPages.map(p => (
            <CommandItem
              key={p.path}
              value={p.title}
              onSelect={() => handleSelect(p.path)}
              className="flex items-center gap-2.5"
            >
              <p.icon className="h-4 w-4 text-muted-foreground" />
              {p.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
