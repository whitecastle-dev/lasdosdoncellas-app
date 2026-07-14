import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Route as RouteIcon, Truck } from "lucide-react";

export default function DeliveryRoutes() {
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState([]);
  const [openDrawer, setOpenDrawer] = useState(false);

  const load = async () => {
    try {
      const [r, n] = await Promise.all([
        api.get("/delivery-routes"),
        api.get("/delivery-notes"),
      ]);
      setRows(r.data);
      setNotes(n.data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  useEffect(() => { load(); }, []);

  const pendientes = notes.filter((n) => n.estado === "pendiente");
  const notesById = Object.fromEntries(notes.map((n) => [n.id, n]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{rows.length} rutas · {pendientes.length} albaranes pendientes</div>
        <button
          onClick={() => setOpenDrawer(true)}
          className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2"
          data-testid="rt-new"
        >
          <Plus size={14} />Nueva ruta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.length === 0 && <div className="col-span-full py-10 text-center text-gray-400">Sin rutas.</div>}
        {rows.map((r) => {
          const rNotes = (r.delivery_note_ids || []).map((id) => notesById[id]).filter(Boolean);
          const total = rNotes.reduce((s, n) => s + (n.total || 0), 0);
          return (
            <div key={r.id} className="cms-card border border-gray-200 p-5" data-testid={`rt-card-${r.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RouteIcon size={16} className="text-[#C5A059]" />
                  <div>
                    <div className="font-medium mono text-sm">{r.numero}</div>
                    <div className="text-xs text-gray-500">{r.fecha}</div>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800">{r.estado}</span>
              </div>
              <div className="text-sm mb-2">
                <div className="text-xs text-gray-400">Repartidor</div>
                <div>{r.repartidor_nombre || "—"}</div>
              </div>
              <div className="text-sm mb-2">
                <div className="text-xs text-gray-400">Albaranes ({rNotes.length})</div>
                <ul className="text-xs list-disc list-inside">
                  {rNotes.map((n) => (
                    <li key={n.id}>{n.numero} — {n.client_name} — {formatMoney(n.total)}</li>
                  ))}
                </ul>
              </div>
              <div className="border-t pt-3 mt-3 flex justify-between font-serif">
                <span>Total ruta</span><span>{formatMoney(total)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {openDrawer && (
        <RouteDrawer
          pendingNotes={pendientes}
          onClose={() => setOpenDrawer(false)}
          onSaved={() => { setOpenDrawer(false); load(); }}
        />
      )}
    </div>
  );
}

function RouteDrawer({ pendingNotes, onClose, onSaved }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    repartidor_nombre: "",
    delivery_note_ids: [],
    notas: "",
  });
  const toggle = (id) => {
    const ids = form.delivery_note_ids.includes(id)
      ? form.delivery_note_ids.filter((x) => x !== id)
      : [...form.delivery_note_ids, id];
    setForm({ ...form, delivery_note_ids: ids });
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/delivery-routes", form);
      toast.success("Ruta creada");
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="rt-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b">
          <div className="font-serif text-2xl flex items-center gap-2">
            <Truck size={20} className="text-[#C5A059]" />Nueva ruta
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label-eyebrow text-gray-500 mb-1">Fecha</div>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="label-eyebrow text-gray-500 mb-1">Repartidor</div>
              <input
                value={form.repartidor_nombre}
                onChange={(e) => setForm({ ...form, repartidor_nombre: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm"
                data-testid="rt-repartidor"
              />
            </div>
          </div>
          <div>
            <div className="label-eyebrow text-gray-500 mb-1">Albaranes pendientes ({pendingNotes.length})</div>
            <div className="border border-gray-200 max-h-64 overflow-y-auto">
              {pendingNotes.length === 0 && (
                <div className="p-4 text-center text-xs text-gray-400">Sin albaranes pendientes</div>
              )}
              {pendingNotes.map((n) => (
                <label
                  key={n.id}
                  className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                  data-testid={`rt-note-${n.id}`}
                >
                  <input
                    type="checkbox"
                    checked={form.delivery_note_ids.includes(n.id)}
                    onChange={() => toggle(n.id)}
                  />
                  <div className="flex-1 text-sm">
                    <div className="flex justify-between">
                      <span className="mono text-xs text-gray-500">{n.numero}</span>
                      <span className="font-serif">{n.total?.toFixed(2)}€</span>
                    </div>
                    <div>{n.client_name}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="label-eyebrow text-gray-500 mb-1">Notas</div>
            <textarea
              rows={2}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="w-full border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={form.delivery_note_ids.length === 0}
            className="px-5 py-2.5 bg-black text-[#C5A059] disabled:opacity-40"
            data-testid="rt-save"
          >
            Crear ruta ({form.delivery_note_ids.length} albaranes)
          </button>
        </form>
      </div>
    </div>
  );
}
