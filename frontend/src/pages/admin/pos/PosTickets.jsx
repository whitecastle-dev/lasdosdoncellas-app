import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Receipt, Search } from "lucide-react";

export default function PosTickets() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const load = async () => {
    try {
      const r = await api.get("/pos/tickets?limit=200");
      setRows(r.data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  useEffect(() => { load(); }, []);
  const filtered = rows.filter((t) =>
    !q ||
    t.numero?.toLowerCase().includes(q.toLowerCase()) ||
    t.session_numero?.toLowerCase().includes(q.toLowerCase()) ||
    t.cliente_nombre?.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nº ticket, sesión o cliente…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 text-sm"
            data-testid="pos-tickets-search"
          />
        </div>
        <div className="text-sm text-gray-500">{filtered.length} tickets</div>
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Nº</th>
              <th>Fecha</th>
              <th>Sesión</th>
              <th>Método</th>
              <th>Cliente</th>
              <th className="text-right">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin tickets.</td></tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`pos-ticket-row-${t.id}`}>
                <td className="px-4 py-2 mono text-xs">{t.numero}</td>
                <td className="text-xs text-gray-500">{(t.created_at || "").slice(0, 16).replace("T", " ")}</td>
                <td className="text-xs mono">{t.session_numero}</td>
                <td className="text-xs"><span className="px-2 py-0.5 bg-gray-100">{t.metodo_pago}</span></td>
                <td className="text-sm">{t.cliente_nombre || "—"}</td>
                <td className="text-right font-serif">{formatMoney(t.total)}</td>
                <td>
                  <button
                    onClick={() => setSelected(t)}
                    className="text-xs text-gray-500 hover:text-black underline"
                    data-testid={`pos-ticket-view-${t.id}`}
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <TicketModal ticket={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TicketModal({ ticket, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-md w-full" onClick={(e) => e.stopPropagation()} data-testid="pos-ticket-modal">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="font-serif text-xl flex items-center gap-2">
            <Receipt size={18} className="text-[#C5A059]" />Ticket {ticket.numero}
          </div>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="p-6 space-y-3 text-sm">
          <div className="text-xs text-gray-500">
            {(ticket.created_at || "").slice(0, 19).replace("T", " ")} · sesión {ticket.session_numero}
          </div>
          <div className="border-t border-b py-3 space-y-1">
            {ticket.items.map((it, i) => (
              <div key={i} className="flex justify-between">
                <div>
                  <div>{it.name}</div>
                  <div className="text-xs text-gray-400">{it.qty} × {formatMoney(it.unit_price)}</div>
                </div>
                <div className="font-serif">{formatMoney(it.line_total)}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatMoney(ticket.subtotal)}</span></div>
          <div className="flex justify-between text-gray-500"><span>IVA {ticket.vat_pct}%</span><span>{formatMoney(ticket.vat_amount)}</span></div>
          <div className="flex justify-between font-serif text-xl border-t pt-2"><span>Total</span><span>{formatMoney(ticket.total)}</span></div>
          <div className="text-xs text-gray-500">
            Pago: {ticket.metodo_pago} · Efectivo {formatMoney(ticket.efectivo)} · Tarjeta {formatMoney(ticket.tarjeta)} · Cambio {formatMoney(ticket.cambio)}
          </div>
        </div>
      </div>
    </div>
  );
}
