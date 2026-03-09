const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const { nome, email, telefone, empresa, mensagem, origem, api_token } = body;

    // Validate API token
    const expectedToken = Deno.env.get("WEBHOOK_API_TOKEN");
    if (!expectedToken || api_token !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid api_token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Validate required fields
    if (!nome || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: nome, email" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for duplicate
    const { data: existing } = await supabase
      .from("leads")
      .select("id, nome")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    const origemFinal = origem || "website";
    const metadata = {
      pagina: origem || "formulario-contato",
    };

    let leadId: string;

    if (existing) {
      // Update existing lead
      await supabase
        .from("leads")
        .update({
          nome: nome.trim(),
          telefone: telefone || null,
          empresa: empresa || null,
          mensagem_original: mensagem || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", existing.id);
      leadId = existing.id;
    } else {
      // Create new lead
      const { data: newLead, error } = await supabase
        .from("leads")
        .insert({
          nome: nome.trim(),
          email: email.toLowerCase().trim(),
          telefone: telefone || null,
          empresa: empresa || null,
          mensagem_original: mensagem || null,
          status: "novo",
          origem: origemFinal,
          origem_metadata: metadata,
        })
        .select("id")
        .single();

      if (error) throw error;
      leadId = newLead.id;

      // Create notification
      const { data: users } = await supabase.auth.admin.listUsers();
      const userId = users?.users?.[0]?.id;
      if (userId) {
        await supabase.from("notificacoes").insert({
          user_id: userId,
          tipo: "novo_lead_webhook",
          titulo: `Novo lead capturado via site: ${nome.trim()}`,
          descricao: empresa ? `${empresa}` : email,
          link: "/crm",
          metadata: { lead_id: leadId },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: leadId, duplicata: !!existing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("capture-lead-website error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
