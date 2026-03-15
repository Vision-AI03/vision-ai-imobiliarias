import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // === WEBHOOK VERIFICATION (GET) ===
  // Meta sends GET with no Authorization header — JWT must be disabled (verify_jwt = false)
  if (req.method === "GET") {
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      // Must return the challenge as plain text — Meta rejects JSON responses
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // === WEBHOOK EVENTS (POST) ===
  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // Respond 200 immediately (Meta requires <20s)
    const processEvent = async () => {
      try {
        const entries = body?.entry || [];
        for (const entry of entries) {
          for (const change of entry.changes || []) {
            const val = change.value;
            if (!val) continue;

            const phoneNumberId = val.metadata?.phone_number_id;
            const displayPhone = normalizePhone(val.metadata?.display_phone_number || "");

            // Find which user owns this phone_number_id
            const { data: config } = await supabase
              .from("whatsapp_config")
              .select("user_id")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();

            const userId = config?.user_id;
            if (!userId) continue;

            // === INCOMING MESSAGES ===
            for (const message of val.messages || []) {
              const fromPhone = normalizePhone(message.from);
              const wamid = message.id;
              const tsWpp = new Date(Number(message.timestamp) * 1000).toISOString();
              const msgType: string = message.type || "text";
              const contactName = val.contacts?.find((c: any) => normalizePhone(c.wa_id) === fromPhone)?.profile?.name || "";

              let conteudo: string | null = null;
              let mediaUrl: string | null = null;

              if (msgType === "text") conteudo = message.text?.body || null;
              else if (message[msgType]?.caption) conteudo = message[msgType].caption;
              if (message[msgType]?.id) mediaUrl = `media:${message[msgType].id}`;

              // Find or create lead
              let leadId: string | null = null;
              const { data: existingLead } = await supabase
                .from("leads")
                .select("id, total_mensagens_whatsapp")
                .eq("user_id", userId)
                .ilike("telefone", `%${fromPhone.slice(-10)}%`)
                .maybeSingle();

              if (existingLead) {
                leadId = existingLead.id;
                await supabase.from("leads").update({
                  ultima_mensagem_whatsapp: tsWpp,
                  whatsapp_respondido: true,
                  total_mensagens_whatsapp: (existingLead.total_mensagens_whatsapp || 0) + 1,
                }).eq("id", leadId);
              } else if (contactName) {
                const { data: newLead } = await supabase
                  .from("leads")
                  .insert({
                    user_id: userId,
                    nome: contactName,
                    telefone: fromPhone,
                    status: "novo",
                    origem: "whatsapp",
                    ultima_mensagem_whatsapp: tsWpp,
                    total_mensagens_whatsapp: 1,
                  })
                  .select("id")
                  .single();
                if (newLead) leadId = newLead.id;
              }

              // Save message
              await supabase.from("whatsapp_mensagens").insert({
                user_id: userId,
                lead_id: leadId,
                wamid,
                direcao: "recebida",
                tipo_mensagem: msgType,
                conteudo,
                media_url: mediaUrl,
                telefone_remetente: fromPhone,
                telefone_destinatario: displayPhone,
                timestamp_whatsapp: tsWpp,
              });

              // Trigger analysis if >= 3 unanalyzed messages
              if (leadId) {
                const { count } = await supabase
                  .from("whatsapp_mensagens")
                  .select("id", { count: "exact", head: true })
                  .eq("lead_id", leadId)
                  .eq("analisado", false);

                if ((count || 0) >= 3) {
                  await supabase.functions.invoke("analyze-lead-stage", {
                    body: { lead_id: leadId, user_id: userId },
                  });
                }
              }
            }

            // === STATUS UPDATES ===
            for (const statusUpdate of val.statuses || []) {
              const { error } = await supabase
                .from("whatsapp_mensagens")
                .update({ status_entrega: statusUpdate.status })
                .eq("wamid", statusUpdate.id);
              // If not found, it's an outgoing message we haven't tracked yet — skip
              void error;
            }
          }
        }
      } catch (err) {
        console.error("Webhook processing error:", err);
      }
    };

    // Fire and forget — don't await to stay under 20s limit
    processEvent();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
