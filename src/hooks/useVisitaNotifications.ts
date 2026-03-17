import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useVisitaNotifications() {
  const checkOverdueVisitas = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const twoHoursAgoStr = twoHoursAgo.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const twoHoursAgoDate = twoHoursAgo.toISOString().slice(0, 10);

    // Fetch overdue agendada visits
    const { data: visitas } = await supabase
      .from("agenda_visitas")
      .select("id, data_visita, hora_visita, lead_id, imovel_id, lead:leads(nome), imovel:imoveis(titulo, tipo)")
      .eq("user_id", user.id)
      .eq("status", "agendada")
      .lte("data_visita", twoHoursAgoDate) as any;

    if (!visitas?.length) return;

    for (const v of visitas) {
      // Check if this visit's date+time is actually > 2h ago
      const visitaDateTime = new Date(`${v.data_visita}T${v.hora_visita || "00:00"}`);
      if (visitaDateTime > twoHoursAgo) continue; // not yet overdue

      const leadNome = (v.lead as any)?.nome || "lead";
      const imovelNome = (v.imovel as any)?.titulo || (v.imovel as any)?.tipo || "imóvel";

      // Check for existing notification for this visit
      const { data: existing } = await supabase
        .from("notificacoes")
        .select("id")
        .eq("user_id", user.id)
        .eq("tipo", "feedback_visita")
        .filter("metadata->>'visita_id'", "eq", v.id)
        .maybeSingle() as any;

      if (existing) continue; // already notified

      // Update visit to realizada
      await supabase
        .from("agenda_visitas")
        .update({ status: "realizada" })
        .eq("id", v.id);

      // Create notification
      await supabase
        .from("notificacoes")
        .insert({
          user_id: user.id,
          tipo: "feedback_visita",
          titulo: "Como foi a visita?",
          descricao: `A visita ao ${imovelNome} com ${leadNome} foi realizada? Atualize o resultado.`,
          link: "/agenda",
          lida: false,
          metadata: { visita_id: v.id },
        } as any);
    }
  }, []);

  useEffect(() => {
    checkOverdueVisitas();
    const interval = setInterval(checkOverdueVisitas, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkOverdueVisitas]);
}
