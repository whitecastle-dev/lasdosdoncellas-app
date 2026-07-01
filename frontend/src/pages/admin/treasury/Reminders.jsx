import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Bell, ArrowUpCircle, ArrowDownCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PayModal } from "./IssuedInvoices";

export default function Reminders() {
  const [d, setD] = useState(null);
  const [paying, setPaying] = useState(null); // { invoice, kind }
  const load = async () => {
    try { const r = await api.get("/treasury/reminders"); setD(r.data); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []);
  if (!d) return <div className="text-gray-400 py-10 text-center">Cargando…</div>;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Section title="Cobros" icon={ArrowUpCircle} color="text-green-700"
        vencidas={d.cobrar.vencidas} proximas={d.cobrar.proximas}
        onPay={(inv) => setPaying({ invoice: inv, kind: "issued" })} kind="cobrar" />
      <Section title="Pagos" icon={ArrowDownCircle} color="text-red-700"
        vencidas={d.pagar.vencidas} proximas={d.pagar.proximas}
        onPay={(inv) => setPaying({ invoice: inv, kind: "supplier" })} kind="pagar" />
      {paying && <PayModal invoice={paying.invoice} kind={paying.kind} onClose={() => setPaying(null)} onDone={() => { setPaying(null); load(); }} />}
    </div>
  );
}

function Section({ title, icon: Icon, color, vencidas, proximas, onPay, kind }) {
  return (
    <div className="space-y-4" data-testid={`rem-section-${kind}`}>
      <div className="flex items-center gap-2"><Icon size={20} className={color} /><div className="font-serif text-2xl">{title}</div></div>
      {vencidas.length > 0 && (
        <div className="cms-card p-4 border-l-4 border-red-500 bg-red-50">
          <div className="label-eyebrow text-red-800 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Vencidas ({vencidas.length})</div>
          <div className="space-y-2">
            {vencidas.map((i) => <InvoiceItem key={i.id} inv={i} kind={kind} onPay={onPay} urgent />)}
          </div>
        </div>
      )}
      {proximas.length > 0 && (
        <div className="cms-card p-4 border-l-4 border-amber-400 bg-amber-50">
          <div className="label-eyebrow text-amber-900 mb-2">Vencen en los próximos 7 días ({proximas.length})</div>
          <div className="space-y-2">
            {proximas.map((i) => <InvoiceItem key={i.id} inv={i} kind={kind} onPay={onPay} />)}
          </div>
        </div>
      )}
      {vencidas.length === 0 && proximas.length === 0 && (
        <div className="cms-card p-6 text-center text-gray-400 text-sm">Nada por {kind} en los próximos 7 días.</div>
      )}
    </div>
  );
}

function InvoiceItem({ inv, kind, onPay, urgent }) {
  const name = inv.client_name || inv.provider?.name || inv.provider?.company;
  return (
    <div className="flex items-center justify-between bg-white p-3 border border-gray-200" data-testid={`rem-item-${inv.id}`}>
      <div className="flex-1">
        <div className="font-medium text-sm">{name}</div>
        <div className="text-xs text-gray-500 mono">{inv.invoice_number} · vence {inv.due_date}{urgent && " (vencida)"}</div>
      </div>
      <div className="text-right mr-3">
        <div className="font-serif text-lg">{formatMoney(inv.total)}</div>
      </div>
      <button onClick={() => onPay(inv)} className="text-xs px-3 py-1.5 border border-black hover:bg-black hover:text-[#C5A059] flex items-center gap-1" data-testid={`rem-pay-${inv.id}`}>
        <CheckCircle2 size={11} /> {kind === "cobrar" ? "Cobrar" : "Pagar"}
      </button>
    </div>
  );
}
