import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, ClipboardList, Package, Trash2 } from "lucide-react";

export default function GoodsReceipts() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const load = async () => {
    try { const r = await api.get("/goods-receipts"); setRows(r.data); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{rows.length} recepciones registradas</div>
        <button onClick={() => setOpen(true)} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="rec-new"><Plus size={14} />Nueva recepción</button>
      </div>
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr>
            <th className="px-4 py-3">Nº</th><th>Fecha</th><th>Proveedor</th>
            <th>PO origen</th><th className="text-right">Items</th><th className="text-right">Total</th>
            <th>Factura</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin recepciones aún.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`rec-row-${r.id}`}>
                <td className="px-4 py-2 mono text-xs">{r.receipt_number}</td>
                <td className="text-xs text-gray-500">{r.created_at?.slice(0, 10)}</td>
                <td>{r.provider?.company || r.provider?.name}</td>
                <td className="mono text-xs text-gray-500">{r.po_number || "—"}</td>
                <td className="text-right">{r.items?.length}</td>
                <td className="text-right font-serif">{formatMoney(r.total)}</td>
                <td className="text-xs">{r.invoice_id ? <span className="text-green-700">✓ Generada</span> : <span className="text-gray-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <ReceiptDrawer onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function ReceiptDrawer({ onClose, onSaved }) {
  const [providers, setProviders] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [pos, setPos] = useState([]);
  const [form, setForm] = useState({ provider_id: "", purchase_order_id: "", items: [], notes: "", generate_invoice: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, pr, l, po] = await Promise.all([
        api.get("/providers"), api.get("/products"), api.get("/inventory/locations"),
        api.get("/purchase-orders?status=pending"),
      ]);
      setProviders(p.data); setProducts(pr.data); setLocations(l.data); setPos(po.data);
    })().catch((e) => toast.error(formatApiError(e)));
  }, []);

  const fromPO = (poId) => {
    const po = pos.find((p) => p.id === poId);
    if (!po) return;
    setForm({
      provider_id: po.provider_id, purchase_order_id: poId,
      notes: "", generate_invoice: true,
      items: po.items.map((i) => ({
        product_id: i.product_id, sku: i.sku, name: i.name,
        qty_received: i.qty, unit_cost: i.unit_cost,
        lot_number: "", location_id: locations[0]?.id || null, expires_at: "",
      })),
    });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: products[0]?.id, sku: products[0]?.sku || "", name: products[0]?.name || "", qty_received: 1, unit_cost: 0, lot_number: "", location_id: locations[0]?.id || null, expires_at: "" }] });
  const upItem = (i, k, v) => setForm({ ...form, items: form.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) });
  const rmItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const total = form.items.reduce((s, i) => s + (Number(i.qty_received) || 0) * (Number(i.unit_cost) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    if (!form.provider_id || form.items.length === 0) return toast.error("Selecciona proveedor y al menos 1 ítem");
    setSaving(true);
    try {
      const payload = {
        ...form,
        purchase_order_id: form.purchase_order_id || null,
        items: form.items.map((i) => ({
          ...i,
          qty_received: Number(i.qty_received) || 0,
          unit_cost: Number(i.unit_cost) || 0,
          expires_at: i.expires_at || null,
          location_id: i.location_id || null,
        })),
      };
      const { data } = await api.post("/goods-receipts", payload);
      toast.success(`Recepción ${data.receipt.receipt_number}${data.invoice ? " · Factura " + data.invoice.invoice_number : ""}`);
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="rec-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b sticky top-0 bg-white z-10">
          <div className="font-serif text-2xl flex items-center gap-2"><ClipboardList size={20} className="text-[#C5A059]" />Nueva recepción</div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <F label="Desde pedido pendiente">
              <select value={form.purchase_order_id} onChange={(e) => { setForm({ ...form, purchase_order_id: e.target.value }); if (e.target.value) fromPO(e.target.value); }}
                className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="rec-po">
                <option value="">— manual —</option>
                {pos.map((p) => <option key={p.id} value={p.id}>{p.po_number} · {p.provider?.company || p.provider?.name} · {formatMoney(p.total)}</option>)}
              </select>
            </F>
            <F label="Proveedor *">
              <select required value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm bg-white" data-testid="rec-provider">
                <option value="">—</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.company || p.name}</option>)}
              </select>
            </F>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label-eyebrow text-gray-500">Líneas</div>
              <button type="button" onClick={addItem} className="text-xs px-3 py-1 border hover:border-black" data-testid="rec-add-item">+ Añadir línea</button>
            </div>
            <div className="border border-gray-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr><th className="text-left px-2 py-2">Producto</th><th className="text-right">Cant.</th><th className="text-right">€/uni</th><th>Lote</th><th>Ubicación</th><th>Caduca</th><th></th></tr>
                </thead>
                <tbody>
                  {form.items.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">
                        <select value={it.product_id} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); upItem(i, "product_id", e.target.value); if (p) { upItem(i, "sku", p.sku); upItem(i, "name", p.name); } }}
                          className="w-full border border-gray-200 px-1 py-1 bg-white text-xs" data-testid={`rec-item-product-${i}`}>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td><input type="number" step="0.01" min="0" value={it.qty_received} onChange={(e) => upItem(i, "qty_received", e.target.value)} className="w-16 border border-gray-200 px-1 py-1 text-right" data-testid={`rec-item-qty-${i}`} /></td>
                      <td><input type="number" step="0.01" min="0" value={it.unit_cost} onChange={(e) => upItem(i, "unit_cost", e.target.value)} className="w-20 border border-gray-200 px-1 py-1 text-right" data-testid={`rec-item-cost-${i}`} /></td>
                      <td><input value={it.lot_number || ""} onChange={(e) => upItem(i, "lot_number", e.target.value)} placeholder="auto" className="w-24 border border-gray-200 px-1 py-1" /></td>
                      <td>
                        <select value={it.location_id || ""} onChange={(e) => upItem(i, "location_id", e.target.value || null)} className="w-full border border-gray-200 px-1 py-1 bg-white text-xs">
                          <option value="">—</option>
                          {locations.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                        </select>
                      </td>
                      <td><input type="date" value={it.expires_at || ""} onChange={(e) => upItem(i, "expires_at", e.target.value)} className="border border-gray-200 px-1 py-1" data-testid={`rec-item-expires-${i}`} /></td>
                      <td><button type="button" onClick={() => rmItem(i)} className="p-1 text-red-600"><Trash2 size={12} /></button></td>
                    </tr>
                  ))}
                  {form.items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-gray-400">Sin líneas — añade o selecciona un pedido.</td></tr>}
                </tbody>
                <tfoot><tr className="border-t-2 border-black bg-gray-50"><td colSpan={6} className="text-right px-2 py-2 font-medium">TOTAL</td><td className="text-right font-serif" data-testid="rec-total">{formatMoney(total)}</td></tr></tfoot>
              </table>
            </div>
          </div>

          <F label="Notas"><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>

          <label className="flex items-center gap-2 text-sm" data-testid="rec-gen-invoice-toggle">
            <input type="checkbox" checked={form.generate_invoice} onChange={(e) => setForm({ ...form, generate_invoice: e.target.checked })} />
            <strong>Generar factura de proveedor automáticamente</strong> (estado: pendiente de pago)
          </label>

          <button type="submit" disabled={saving} className="px-5 py-2.5 bg-black text-[#C5A059] disabled:opacity-50" data-testid="rec-save">
            {saving ? "Registrando…" : "Registrar recepción"}
          </button>
        </form>
      </div>
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
