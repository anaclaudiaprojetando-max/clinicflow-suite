import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { user, clinic } = useAuth();

  const { data: accounts } = useQuery({
    queryKey: ["accounts-summary", clinic?.id],
    queryFn: async () => {
      if (!clinic) return [];
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("tenant_id", clinic.id)
        .is("deleted_at", null)
        .gte("due_date", startOfMonth)
        .lte("due_date", endOfMonth);
      return data || [];
    },
    enabled: !!clinic,
  });

  const { data: recentDocs } = useQuery({
    queryKey: ["recent-docs", clinic?.id],
    queryFn: async () => {
      if (!clinic) return [];
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("clinic_id", clinic.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!clinic,
  });

  const income = accounts?.filter((a) => a.type === "receivable" || a.type === "income").reduce((s, a) => s + Number(a.amount), 0) || 0;
  const expense = accounts?.filter((a) => a.type === "payable" || a.type === "expense").reduce((s, a) => s + Number(a.amount), 0) || 0;
  const balance = income - expense;

  const cards = [
    { title: "Receitas", value: income, icon: TrendingUp, color: "text-success" },
    { title: "Despesas", value: expense, icon: TrendingDown, color: "text-destructive" },
    { title: "Saldo", value: balance, icon: Wallet, color: balance >= 0 ? "text-success" : "text-destructive" },
  ];

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Painel</h1>
        <p className="text-muted-foreground text-sm">Resumo financeiro do mês atual</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="glass-card hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-display font-bold ${card.color}`}>{fmt(card.value)}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Documentos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentDocs && recentDocs.length > 0 ? (
              <div className="space-y-3">
                {recentDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{doc.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(doc.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum documento encontrado.</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
