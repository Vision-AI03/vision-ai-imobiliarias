import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Mail, MessageSquare, DollarSign, TrendingUp } from "lucide-react";

const kpis = [
  { title: "Leads do Mês", value: "—", icon: Users },
  { title: "Reuniões Agendadas", value: "—", icon: Calendar },
  { title: "Taxa Resposta Email", value: "—", icon: Mail },
  { title: "Taxa Resposta WhatsApp", value: "—", icon: MessageSquare },
  { title: "Faturamento do Mês", value: "—", icon: DollarSign },
  { title: "Margem Líquida", value: "—", icon: TrendingUp },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-sm">Leads por Semana</CardTitle></CardHeader>
          <CardContent className="h-64 flex items-center justify-center text-muted-foreground text-sm">Gráfico será implementado na próxima fase</CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-sm">Faturamento 6 Meses</CardTitle></CardHeader>
          <CardContent className="h-64 flex items-center justify-center text-muted-foreground text-sm">Gráfico será implementado na próxima fase</CardContent>
        </Card>
      </div>
    </div>
  );
}
