import {
  LayoutDashboard, Users, FileText, DollarSign, LogOut, KeyRound,
  CheckSquare, DatabaseBackup, Webhook, BarChart2, Home, Calendar,
  UserCheck, Palette, Map, Building2, ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracoesSistema } from "@/hooks/useConfiguracoesSistema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Imóveis", url: "/imoveis", icon: Home },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Corretores", url: "/corretores", icon: UserCheck },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Relatórios", url: "/relatorios", icon: BarChart2 },
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
];

const configItems = [
  { title: "Integrações", url: "/configuracoes/integracoes", icon: Webhook },
  { title: "Credenciais", url: "/configuracoes/credenciais", icon: KeyRound },
  { title: "Aparência", url: "/configuracoes/aparencia", icon: Palette },
  { title: "Portais", url: "/configuracoes/portais", icon: Map },
  { title: "Backup", url: "/configuracoes/backup", icon: DatabaseBackup },
];

export function AppSidebar() {
  const { config } = useConfiguracoesSistema();
  const [configOpen, setConfigOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          {config.logo_url ? (
            <img
              src={config.logo_url}
              alt={config.nome_plataforma}
              className="h-8 w-8 object-contain rounded"
            />
          ) : (
            <Building2 className="h-8 w-8 text-primary" />
          )}
          <span className="text-lg font-bold gradient-primary-text truncate">
            {config.nome_plataforma || "Vision AI"}
          </span>
        </div>
        {config.nome_imobiliaria && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{config.nome_imobiliaria}</p>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer flex items-center justify-between w-full hover:text-foreground transition-colors">
                Configurações
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${configOpen ? "rotate-180" : ""}`}
                />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {configItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="hover:bg-sidebar-accent"
                          activeClassName="bg-sidebar-accent text-primary font-medium"
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
