import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  onSent: () => void;
}

export function EmailComposeDialog({ open, onOpenChange, leads, onSent }: Props) {
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  async function handleGenerateAI() {
    if (!selectedLeadId) {
      toast({ title: "Selecione um lead primeiro", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: { lead_id: selectedLeadId },
      });
      if (error) throw error;
      if (data?.data) {
        setAssunto(data.data.assunto || "");
        setConteudo(data.data.conteudo || "");
        toast({ title: "Rascunho gerado pela IA!", description: "Revise e edite antes de enviar." });
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar email", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!selectedLeadId || !assunto || !conteudo) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (!selectedLead) return;

    setSending(true);

    const htmlContent = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:20px;text-align:center;">
          <span style="color:#fff;font-weight:bold;font-size:20px;">Vision AI</span>
        </div>
        <div style="padding:24px;background:#fff;">
          <h2 style="margin:0 0 16px;">${assunto}</h2>
          <div style="white-space:pre-wrap;color:#333;">${conteudo}</div>
        </div>
        <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:11px;color:#888;">
          Vision AI — Inteligência Artificial para o seu negócio
        </div>
      </div>`;

    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-email", {
        body: { to: selectedLead.email, name: selectedLead.nome, subject: assunto, html: htmlContent },
      });

      if (fnError || data?.error) throw new Error(fnError?.message || data?.error);

      await supabase.from("comunicacoes").insert({
        lead_id: selectedLeadId,
        tipo: "email",
        direcao: "enviado",
        assunto,
        conteudo,
        status: "enviado",
      });

      await supabase.from("leads").update({
        email_enviado: true,
        data_email_enviado: new Date().toISOString(),
      }).eq("id", selectedLeadId);

      toast({ title: "Email enviado com sucesso!" });
      resetForm();
      onOpenChange(false);
      onSent();
    } catch (e: any) {
      toast({ title: "Erro ao enviar email", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  function resetForm() {
    setSelectedLeadId("");
    setAssunto("");
    setConteudo("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>Compor Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Para (Lead)</Label>
            <div className="flex gap-2">
              <Select value={selectedLeadId || "none"} onValueChange={(v) => setSelectedLeadId(v === "none" ? "" : v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um lead..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {leads.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome} {l.empresa ? `— ${l.empresa}` : ""} ({l.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleGenerateAI}
                disabled={generating || !selectedLeadId}
                className="gap-1.5 shrink-0"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar com IA
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto do email" />
          </div>

          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <Textarea value={conteudo} onChange={e => setConteudo(e.target.value)} placeholder="Escreva o conteúdo do email..." className="min-h-[200px]" />
          </div>

          {/* Preview */}
          {(assunto || conteudo) && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preview</Label>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-primary p-4 flex items-center gap-2">
                    <span className="text-primary-foreground font-bold text-lg">Vision AI</span>
                  </div>
                  <div className="bg-card p-4 space-y-2">
                    <h3 className="font-semibold">{assunto || "Sem assunto"}</h3>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{conteudo || "..."}</div>
                  </div>
                  <div className="bg-secondary/30 px-4 py-3 text-[10px] text-muted-foreground text-center">
                    Vision AI — Inteligência Artificial para o seu negócio
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSend} disabled={sending} className="gap-1.5">
              <Send className="h-4 w-4" />
              {sending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
