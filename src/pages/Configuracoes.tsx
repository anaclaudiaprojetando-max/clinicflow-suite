import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User, Building2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Configuracoes() {
  const { user, clinic } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setFullName(data.full_name || "");
    });
    if (clinic) {
      setClinicName(clinic.name);
      supabase.from("clinics").select("*").eq("id", clinic.id).maybeSingle().then(({ data }) => {
        if (data) {
          setCnpj(data.cnpj || "");
          setPhone(data.phone || "");
          setAddress(data.address || "");
        }
      });
    }
  }, [user, clinic]);

  const handleSave = async () => {
    if (!user || !clinic) return;
    setLoading(true);
    try {
      await supabase.from("profiles").update({ full_name: fullName }).eq("user_id", user.id);
      await supabase.from("clinics").update({ name: clinicName, cnpj, phone, address }).eq("id", clinic.id);
      toast.success("Configurações salvas!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm">Gerencie seu perfil e dados da clínica</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="opacity-60" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Clínica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Clínica</Label>
              <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Opcional" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Button onClick={handleSave} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
        Salvar Configurações
      </Button>
    </div>
  );
}
