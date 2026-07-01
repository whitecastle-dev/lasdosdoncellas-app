import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, FileText, Trash2, CheckCircle2 } from "lucide-react";

const STATUS = { issued: "Emitida", sent: "Enviada", paid: "Cobrada", overdue: "Vencida", cancelled: "Cancelada" };
const COLORS = { issued: "bg-blue-100 text-blue-900", sent: "bg-purple-100 text-purple-900", paid: "bg-green-100 text-green-900", overdue: "bg-red-100 text-red-900", cancelled: "bg-gray-200 text-gray-700" };

export default function IssuedInvoices() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(null);
  const load = async () => {
    try {
      const p = filter ? `?status=${filter}` : "";
      const [a, s] = await Promise.all([api.get(`/issued-invoices${p}`), api.get("/issued-invoices/summary")]);
      setRows(a.data); setSummary(s.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, [filter]);
  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Emitidas por cobrar" total={(summary.issued?.total || 0) + (summary.sent?.total || 0)} count={(summary.issued?.count || 0) + (summary.sent?.count || 0)} color="blue" />
          <StatCard label="Vencidas" total={summary.overdue?.total || 0} count={summary.overdue?.count || 0} color="red" />
          <StatCard label="Cobradas" total={summary.paid?.total || 0} count={summary.paid?.count || 0} color="green" />
          <StatCard label="Canceladas" total={summary.cancelled?.total || 0} count={summary.cancelled?.count || 0} color="gray" />
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {["", ...Object.keys(STATUS)].map((s) => (
            <button key={s} onClick={() => setFilter(s)} data-testid={`emit-filter-${s || "all"}`}
              className={`px-3 py-1.5 text-xs border ${filter === s ? "border-black bg-black text-[#C5A059]" : "border-gray-300 hover:border-black"}`}>
              {s ? STATUS[s] : "Todas"}
            </button>
          ))}
        </div>
        <button onClick={() => setOpen(true)} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="emit-new"><Plus size={14} />Nueva factura</button>
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr>
            <th className="px-4 py-3">Nº</th><th>Emitida</th><th>Vence</th><th>Cliente</th>
            <th className="text-right">Base</th><th className="text-right">IVA</th><th className="text-right">Total</th>
            <th>Estado</th><th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-gray-400">Sin facturas.</td></tr>}
            {rows.map((i) => (
              <tr key={i.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`emit-row-${i.id}`}>
                <td className="px-4 py-2 mono text-xs">{i.invoice_number}</td>
                <td className="text-xs">{i.issue_date}</td>
                <td className="text-xs">{i.due_date || "—"}</td>
                <td>{i.client_name}<div className="text-xs text-gray-500">{i.client_tax_id || i.client_email || ""}</div></td>
                <td className="text-right mono">{formatMoney(i.subtotal)}</td>
                <td className="text-right mono text-xs text-gray-500">{formatMoney(i.vat_amount)}</td>
                <td className="text-right font-serif">{formatMoney(i.total)}</td>
                <td><span className={`text-xs px-2 py-0.5 ${COLORS[i.status]}`}>{STATUS[i.status]}</span></td>
                <td className="text-right pr-2">
                  {(i.status === "issued" || i.status === "sent") && (
                    <button onClick={() => setPaying(i)} className="text-xs px-2 py-1 border border-green-600 text-green-700 hover:bg-green-50 flex items-center gap-1" data-testid={`emit-pay-${i.id}`}>
                      <CheckCircle2 size={11} /> Marcar cobrada
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <NewInvoiceDrawer onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
      {paying && <PayModal invoice={paying} kind="issued" onClose={() => setPaying(null)} onDone={() => { setPaying(null); load(); }} />}
    </div>
  );
}

function StatCard({ label, total, count, color }) {
  const colors = { blue: "border-blue-300 bg-blue-50", red: "border-red-300 bg-red-50", green: "border-green-300 bg-green-50", gray: "border-gray-300 bg-gray-50" };
  return (
    <div className={`border ${colors[color]} p-4`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="font-serif text-2xl mt-1">{formatMoney(total)}</div>
      <div className="text-xs text-gray-500 mt-1">{count} factura{count !== 1 ? "s" : ""}</div>
    </div>
  );
}

function NewInvoiceDrawer({ onClose, onSaved }) {
  const [form, setForm] = useState({ client_type: "manual", client_name: "", client_tax_id: "", client_email: "", lines: [{ concepto: "", qty: 1, unit_price: 0 }], vat_pct: 21, issue_date: new Date().toISOString().slice(0, 10), due_date: "", notes: "" });
  const [businessClients, setBiz] = useState([]);
  useEffect(() => { api.get("/business-customers").then((r) => setBiz(r.data)).catch(() => {}); }, []);
  const setL = (i, k, v) => setForm({ ...form, lines: form.lines.map((l, idx) => idx === i ? { ...l, [k]: k === "concepto" ? v : Number(v) } : l) });
  const addL = () => setForm({ ...form, lines: [...form.lines, { concepto: "", qty: 1, unit_price: 0 }] });
  const rmL = (i) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });
  const subtotal = form.lines.reduce((s, l) => s + (l.qty || 0) * (l.unit_price || 0), 0);
  const vat = subtotal * (form.vat_pct / 100);
  const total = subtotal + vat;

  const pickBiz = (id) => {
    const c = businessClients.find((b) => b.id === id);
    if (!c) return;
    setForm({ ...form, client_type: "business", client_id: id, client_name: c.company_name, client_tax_id: c.tax_id, client_email: c.email });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.client_name || form.lines.length === 0) return toast.error("Cliente y al menos 1 línea");
    try {
      await api.post("/issued-invoices", { ...form, due_date: form.due_date || null });
      toast.success("Factura creada"); onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="emit-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b sticky top-0 bg-white z-10">
          <div className="font-serif text-2xl flex items-center gap-2"><FileText size={20} className="text-[#C5A059]" />Nueva factura</div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <F label="Cliente empresa (opcional — autorellena)">
            <select onChange={(e) => e.target.value && pickBiz(e.target.value)} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="emit-biz">
              <option value="">— manual —</option>
              {businessClients.map((c) => <option key={c.id} value={c.id}>{c.company_name} · {c.tax_id}</option>)}
            </select>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Cliente *"><input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="emit-client-name" /></F>
            <F label="CIF/NIF"><input value={form.client_tax_id} onChange={(e) => setForm({ ...form, client_tax_id: e.target.value })} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Email"><input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="IVA %"><input type="number" step="0.01" value={form.vat_pct} onChange={(e) => setForm({ ...form, vat_pct: Number(e.target.value) })} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Emitida"><input type="date" required value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Vencimiento"><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full border border-gray-200 px-3 py-2 text-sm" data-testid="emit-due" /></F>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="label-eyebrow text-gray-500">Líneas</div>
              <button type="button" onClick={addL} className="text-xs px-3 py-1 border" data-testid="emit-add-line">+ Añadir</button>
            </div>
            <div className="border border-gray-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500"><tr><th className="text-left px-2 py-2">Concepto</th><th className="text-right">Cant.</th><th className="text-right">€/uni</th><th className="text-right">Subtotal</th><th></th></tr></thead>
                <tbody>
                  {form.lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1"><input value={l.concepto} onChange={(e) => setL(i, "concepto", e.target.value)} className="w-full border border-gray-200 px-2 py-1" data-testid={`emit-line-concepto-${i}`} /></td>
                      <td><input type="number" step="0.01" min="0" value={l.qty} onChange={(e) => setL(i, "qty", e.target.value)} className="w-16 border border-gray-200 px-1 py-1 text-right" /></td>
                      <td><input type="number" step="0.01" min="0" value={l.unit_price} onChange={(e) => setL(i, "unit_price", e.target.value)} className="w-24 border border-gray-200 px-1 py-1 text-right" /></td>
                      <td className="text-right mono">{formatMoney((l.qty || 0) * (l.unit_price || 0))}</td>
                      <td><button type="button" onClick={() => rmL(i)} className="p-1 text-red-600"><Trash2 size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t"><td colSpan={3} className="text-right px-2 py-1 text-xs text-gray-500">Base imponible</td><td className="text-right mono">{formatMoney(subtotal)}</td><td></td></tr>
                  <tr><td colSpan={3} className="text-right px-2 py-1 text-xs text-gray-500">IVA {form.vat_pct}%</td><td className="text-right mono text-gray-500">{formatMoney(vat)}</td><td></td></tr>
                  <tr className="border-t-2 border-black"><td colSpan={3} className="text-right px-2 py-2 font-medium">TOTAL</td><td className="text-right font-serif" data-testid="emit-total">{formatMoney(total)}</td><td></td></tr>
                </tfoot>
              </table>
            </div>
          </div>
          <F label="Notas"><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]" data-testid="emit-save">Crear factura</button>
        </form>
      </div>
    </div>
  );
}

export function PayModal({ invoice, kind, onClose, onDone }) {
  const [accounts, setAccounts] = useState([]);
  const [account_id, setAcc] = useState("");
  const [payment_date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get("/treasury/accounts").then((r) => {
      const active = r.data.filter((a) => a.activo);
      setAccounts(active); if (active[0]) setAcc(active[0].id);
    }).catch((e) => toast.error(formatApiError(e)));
  }, []);
  const confirm = async () => {
    if (!account_id) return toast.error("Selecciona cuenta");
    setSaving(true);
    try {
      const url = kind === "issued" ? `/issued-invoices/${invoice.id}/mark-paid` : `/treasury/pay-supplier-invoice/${invoice.id}`;
      const { data } = await api.post(url, { account_id, payment_date, notes });
      toast.success(`${kind === "issued" ? "Cobro" : "Pago"} registrado · ${data.movement.numero}`);
      onDone();
    } catch (err) { toast.error(formatApiError(err)); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="pay-modal">
        <div className="font-serif text-xl mb-1">{kind === "issued" ? "Marcar como cobrada" : "Marcar como pagada"}</div>
        <div className="text-sm text-gray-500 mb-4">
          <strong>{invoice.invoice_number}</strong> · {invoice.client_name || invoice.provider?.name} · {formatMoney(invoice.total)}
        </div>
        <div className="space-y-3">
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Cuenta *</label>
            <select value={account_id} onChange={(e) => setAcc(e.target.value)} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="pay-account">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nombre} · saldo {formatMoney(a.saldo)}</option>)}
            </select>
          </div>
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Fecha</label>
            <input type="date" value={payment_date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Notas</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-gray-200 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300">Cancelar</button>
          <button onClick={confirm} disabled={saving} className="px-5 py-2 bg-black text-[#C5A059] disabled:opacity-50" data-testid="pay-confirm">
            {saving ? "…" : `Confirmar ${kind === "issued" ? "cobro" : "pago"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
