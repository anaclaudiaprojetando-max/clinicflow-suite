import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Edit, Loader2 } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, setMonth, setYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

type Account = Tables<"accounts">;
type AccountType = "payable" | "receivable" | "expense" | "income";
type AccountStatus = "scheduled" | "pending" | "paid" | "overdue" | "cancelled" | "define";

const typeLabels: Record<AccountType, string> = { payable: "A Pagar", receivable: "A Receber", expense: "Despesa", income: "Receita" };
const statusLabels: Record<AccountStatus, string> = { scheduled: "Agendado", pending: "Pendente", paid: "Pago", overdue: "Vencido", cancelled: "Cancelado", define: "Definir" };
const statusColors: Record<AccountStatus, string> = {
  scheduled: "bg-accent text-accent-foreground",
  pending: "bg-warning/20 text-warning",
  paid: "bg-success/20 text-success",
  overdue: "bg-destructive/20 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  define: "bg-secondary text-secondary-foreground",
};

const emptyForm = { description: "", amount: "", due_date: "", type: "payable" as AccountType, status: "pending" as AccountStatus, category: "", notes: "" };

export default function Financeiro() {
  const { user, clinic } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts", clinic?.id, monthStart],
    queryFn: async () => {
      if (!clinic) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("tenant_id", clinic.id)
        .is("deleted_at", null)
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!clinic,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !clinic) throw new Error("Sem autenticação");
      const payload = {
        description: form.description,
        amount: parseFloat(form.amount),
        due_date: form.due_date,
        type: form.type as AccountType,
        status: form.status as AccountStatus,
        category: form.category || null,
        notes: form.notes || null,
        user_id: user.id,
        tenant_id: clinic.id,
        clinic_id: clinic.id,
      };
      if (editId) {
        const { error } = await supabase.from("accounts").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Conta atualizada!" : "Conta criada!");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["accounts-summary"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta removida!");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["accounts-summary"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicateMonthMutation = useMutation({
    mutationFn: async () => {
      if (!user || !clinic) throw new Error("Sem autenticação");
      const prevMonth = subMonths(selectedMonth, 1);
      const prevStart = format(startOfMonth(prevMonth), "yyyy-MM-dd");
      const prevEnd = format(endOfMonth(prevMonth), "yyyy-MM-dd");
      const { data: prevAccounts, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("tenant_id", clinic.id)
        .is("deleted_at", null)
        .gte("due_date", prevStart)
        .lte("due_date", prevEnd);
      if (error) throw error;
      if (!prevAccounts || prevAccounts.length === 0) {
        throw new Error("Nenhuma conta encontrada no mês anterior");
      }
      const newAccounts = prevAccounts.map((a) => {
        const oldDate = new Date(a.due_date);
        const day = oldDate.getDate();
        const newDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
        return {
          description: a.description,
          amount: 0,
          due_date: format(newDate, "yyyy-MM-dd"),
          type: a.type,
          status: "define" as AccountStatus,
          category: a.category,
          notes: a.notes,
          user_id: user.id,
          tenant_id: clinic.id,
          clinic_id: clinic.id,
        };
      });
      const { error: insertError } = await supabase.from("accounts").insert(newAccounts);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success("Contas do mês anterior duplicadas!");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setOpen(false);
  };

  const openEdit = (a: Account) => {
    setForm({
      description: a.description,
      amount: String(a.amount),
      due_date: a.due_date,
      type: a.type as AccountType,
      status: a.status as AccountStatus,
      category: a.category || "",
      notes: a.notes || "",
    });
    setEditId(a.id);
    setOpen(true);
  };

  const navigateMonth = (dir: number) => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground text-sm">Gestão de contas a pagar e receber</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => duplicateMonthMutation.mutate()} disabled={duplicateMonthMutation.isPending}>
            {duplicateMonthMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Duplicar Mês Anterior
          </Button>
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">{editId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AccountType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as AccountStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimento</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" />
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {editId ? "Salvar" : "Criar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigateMonth(-1)}>←</Button>
        <span className="text-lg font-display font-semibold capitalize">
          {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => navigateMonth(1)}>→</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : accounts && accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="glass-card hover:shadow-md transition-all">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{a.description}</span>
                      <Badge variant="secondary" className="text-xs">{typeLabels[a.type as AccountType]}</Badge>
                      <Badge className={`text-xs ${statusColors[a.status as AccountStatus]}`}>{statusLabels[a.status as AccountStatus]}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Venc: {format(new Date(a.due_date), "dd/MM/yyyy")}</span>
                      {a.category && <span>• {a.category}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-display font-bold ${(a.type === "payable" || a.type === "expense") ? "text-destructive" : "text-success"}`}>
                      {Number(a.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => deleteMutation.mutate(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma conta neste mês. Clique em "Nova Conta" para começar.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
