import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Images, Upload, CheckCircle2, X, Loader2, Building2 } from "lucide-react";

interface ImovelSemFoto {
  id: string;
  codigo: string | null;
  titulo: string | null;
  tipo: string;
  bairro: string | null;
}

interface ImovelUploadState {
  imovelId: string;
  files: File[];
  uploading: boolean;
  done: boolean;
  error: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imoveis: ImovelSemFoto[];
  onDone: () => void;
}

export default function UploadFotosImoveisModal({ open, onOpenChange, imoveis, onDone }: Props) {
  const { toast } = useToast();
  const [states, setStates] = useState<Record<string, ImovelUploadState>>({});
  const [globalUploading, setGlobalUploading] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = (imovelId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      toast({ title: "Selecione apenas imagens (JPG, PNG, WebP)", variant: "destructive" });
      return;
    }
    setStates(prev => ({
      ...prev,
      [imovelId]: {
        imovelId,
        files: [...(prev[imovelId]?.files || []), ...validFiles],
        uploading: false,
        done: false,
        error: null,
      },
    }));
  };

  const removeFile = (imovelId: string, idx: number) => {
    setStates(prev => ({
      ...prev,
      [imovelId]: {
        ...prev[imovelId],
        files: prev[imovelId].files.filter((_, i) => i !== idx),
      },
    }));
  };

  const uploadForImovel = async (imovelId: string, userId: string): Promise<string[]> => {
    const state = states[imovelId];
    if (!state?.files.length) return [];

    const uploadedUrls: string[] = [];

    for (const file of state.files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${imovelId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("imoveis")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("imoveis")
        .getPublicUrl(path);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const handleUploadAll = async () => {
    const imovelIds = Object.keys(states).filter(id => states[id].files.length > 0);
    if (imovelIds.length === 0) {
      toast({ title: "Nenhuma foto selecionada", variant: "destructive" });
      return;
    }

    setGlobalUploading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast({ title: "Não autenticado", variant: "destructive" }); setGlobalUploading(false); return; }

    let totalUploaded = 0;

    for (const imovelId of imovelIds) {
      setStates(prev => ({ ...prev, [imovelId]: { ...prev[imovelId], uploading: true, error: null } }));

      const urls = await uploadForImovel(imovelId, session.user.id);

      if (urls.length > 0) {
        // Fetch current fotos to append
        const { data: current } = await supabase
          .from("imoveis")
          .select("fotos, foto_destaque")
          .eq("id", imovelId)
          .single();

        const existingFotos: string[] = current?.fotos || [];
        const allFotos = [...existingFotos, ...urls];

        const { error: updateError } = await supabase
          .from("imoveis")
          .update({
            fotos: allFotos,
            foto_destaque: current?.foto_destaque || urls[0],
          })
          .eq("id", imovelId);

        if (updateError) {
          setStates(prev => ({
            ...prev,
            [imovelId]: { ...prev[imovelId], uploading: false, error: updateError.message },
          }));
        } else {
          setStates(prev => ({
            ...prev,
            [imovelId]: { ...prev[imovelId], uploading: false, done: true },
          }));
          totalUploaded++;
        }
      } else {
        setStates(prev => ({
          ...prev,
          [imovelId]: { ...prev[imovelId], uploading: false, error: "Nenhuma foto enviada" },
        }));
      }
    }

    setGlobalUploading(false);
    toast({ title: `Fotos adicionadas em ${totalUploaded} imóvel${totalUploaded !== 1 ? "is" : ""}!` });
    onDone();
    onOpenChange(false);
  };

  const totalWithFiles = Object.values(states).filter(s => s.files.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5 text-primary" />
            Adicionar Fotos aos Imóveis Importados
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {imoveis.length} imóvel{imoveis.length !== 1 ? "is" : ""} sem foto. Selecione as imagens para cada um.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {imoveis.map((imovel) => {
            const state = states[imovel.id];
            const isDone = state?.done;
            const isUploading = state?.uploading;
            const hasError = !!state?.error;
            const files = state?.files || [];

            return (
              <div
                key={imovel.id}
                className={`rounded-lg border p-4 space-y-3 transition-colors ${isDone ? "border-green-500/30 bg-green-500/5" : hasError ? "border-destructive/30 bg-destructive/5" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium line-clamp-1">
                        {imovel.titulo || `${imovel.tipo} — ${imovel.bairro || "Sem bairro"}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{imovel.codigo || imovel.tipo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isDone ? (
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Enviado
                      </Badge>
                    ) : isUploading ? (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Enviando
                      </Badge>
                    ) : files.length > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        {files.length} foto{files.length !== 1 ? "s" : ""}
                      </Badge>
                    ) : null}
                    {!isDone && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => fileInputRefs.current[imovel.id]?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Selecionar fotos
                      </Button>
                    )}
                    <input
                      ref={(el) => { fileInputRefs.current[imovel.id] = el; }}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { handleFileSelect(imovel.id, e.target.files); e.target.value = ""; }}
                    />
                  </div>
                </div>

                {files.length > 0 && !isDone && (
                  <div className="flex flex-wrap gap-2">
                    {files.map((f, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={URL.createObjectURL(f)}
                          alt={f.name}
                          className="h-16 w-20 object-cover rounded border"
                        />
                        <button
                          onClick={() => removeFile(imovel.id, idx)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <p className="text-[9px] text-muted-foreground truncate max-w-[80px] mt-0.5">{f.name}</p>
                      </div>
                    ))}
                  </div>
                )}

                {hasError && (
                  <p className="text-xs text-destructive">{state.error}</p>
                )}

                {isUploading && (
                  <Progress value={undefined} className="h-1 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between bg-background">
          <p className="text-sm text-muted-foreground">
            {totalWithFiles} imóvel{totalWithFiles !== 1 ? "is" : ""} com fotos selecionadas
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={globalUploading}>
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handleUploadAll}
              disabled={totalWithFiles === 0 || globalUploading}
              className="gap-1.5"
            >
              {globalUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar Fotos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
