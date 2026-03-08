import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { contato_ids } = await req.json();

    if (!contato_ids?.length) {
      return new Response(JSON.stringify({ error: "contato_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: contatos, error: cErr } = await supabase
      .from("email_contatos")
      .select("*")
      .in("id", contato_ids)
      .eq("status_envio", "gerado");

    if (cErr || !contatos?.length) {
      return new Response(JSON.stringify({ error: "No generated emails found to send" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Vision AI <onboarding@resend.dev>";
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i];

      const htmlContent = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:20px;text-align:center;">
            <span style="color:#fff;font-weight:bold;font-size:20px;">Vision AI</span>
          </div>
          <div style="padding:24px;background:#fff;">
            <h2 style="margin:0 0 16px;">${contato.email_assunto || ""}</h2>
            <div style="white-space:pre-wrap;color:#333;">${contato.email_gerado || ""}</div>
          </div>
          <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:11px;color:#888;">
            Vision AI — Inteligência Artificial para o seu negócio
          </div>
        </div>`;

      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [contato.email],
            subject: contato.email_assunto || "Vision AI",
            html: htmlContent,
          }),
        });

        const resendData = await resendRes.json();

        if (!resendRes.ok) {
          throw new Error(resendData.message || "Resend error");
        }

        await supabase
          .from("email_contatos")
          .update({
            status_envio: "enviado",
            enviado_em: new Date().toISOString(),
            resend_message_id: resendData.id,
          })
          .eq("id", contato.id);

        // Update list counter
        if (contato.lista_id) {
          await supabase.rpc("increment_emails_enviados", { p_lista_id: contato.lista_id }).catch(() => {
            // If RPC doesn't exist, update directly
            supabase.from("email_lists")
              .update({ emails_enviados: i + 1 })
              .eq("id", contato.lista_id);
          });
        }

        results.push({ id: contato.id, success: true });
      } catch (e: any) {
        console.error(`Error sending to ${contato.email}:`, e);
        await supabase
          .from("email_contatos")
          .update({ status_envio: "erro" })
          .eq("id", contato.id);
        results.push({ id: contato.id, success: false, error: e.message });
      }

      // Delay 2.5s between sends to avoid rate limits
      if (i < contatos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    // Update list totals
    const listIds = [...new Set(contatos.map(c => c.lista_id).filter(Boolean))];
    for (const listId of listIds) {
      const { count } = await supabase
        .from("email_contatos")
        .select("*", { count: "exact", head: true })
        .eq("lista_id", listId)
        .eq("status_envio", "enviado");

      await supabase
        .from("email_lists")
        .update({ emails_enviados: count || 0, status: "em_abordagem" })
        .eq("id", listId);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-niche-emails error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
