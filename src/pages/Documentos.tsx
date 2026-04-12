import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Edit, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

export default function Documentos() {
  const { user, clinic } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", clinic?.id],
    queryFn: async () => {
      if (!clinic) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("clinic_id", clinic.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clinic,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !clinic) return;
    setUploading(true);
    try {
      const path = `${clinic.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        clinic_id: clinic.id,
        name: file.name,
        path,
        content_type: file.type,
        size: file.size,
      });
      if (dbError) throw dbError;

      toast.success("Arquivo enviado!");
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["recent-docs"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      await supabase.storage.from("documents").remove([path]);
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento excluído!");
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["recent-docs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renameMutation = useMutation({
    mutationFn: async () => {
      if (!renameId || !newName.trim()) return;
      const { error } = await supabase.from("documents").update({ name: newName.trim() }).eq("id", renameId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento renomeado!");
      setRenameId(null);
      setNewName("");
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["recent-docs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadFile = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("documents").download(path);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground text-sm">Gerenciador de arquivos da clínica</p>
        </div>
        <div>
          <input ref={fileInput} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.webp" />
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            Enviar Arquivo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : docs && docs.length > 0 ? (
        <div className="space-y-2">
          {docs.map((doc, i) => (
            <motion.div key={doc.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="glass-card hover:shadow-md transition-all">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtSize(doc.size)} • {format(new Date(doc.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadFile(doc.path, doc.name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setRenameId(doc.id); setNewName(doc.name); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => deleteMutation.mutate({ id: doc.id, path: doc.path })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum documento. Clique em "Enviar Arquivo" para começar.
          </CardContent>
        </Card>
      )}

      <Dialog open={!!renameId} onOpenChange={(v) => { if (!v) { setRenameId(null); setNewName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Renomear Documento</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); renameMutation.mutate(); }} className="space-y-4">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={renameMutation.isPending}>
              {renameMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Renomear
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
