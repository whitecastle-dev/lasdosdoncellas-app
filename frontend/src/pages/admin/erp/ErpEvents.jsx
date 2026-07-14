import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, Calendar, MapPin, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";

const TIPOS = ["PRIVADO", "EVENTO", "CATERING", "OTRO"];
const ESTADOS = ["PROGRAMADO", "CONFIRMADO", "COMPLETADO", "CANCELADO"];
const EMPTY = {
  fecha: new Date().toISOString().slice(0, 10), hora_inicio: "", hora_fin: "",
  cliente: "", ubicacion: "", tipo_servicio: "PRIVADO", empleado_id: "",
  num_piezas: 1, descripcion_piezas: "", precio_servicio: 0, gastos: 0,
  observaciones: "", estado: "PROGRAMADO",
};

export default function ErpEvents() {
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState("calendar"); // calendar | list
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get("/erp/events"), api.get("/erp/employees")]);
      setRows(a.data); setEmployees(b.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []);
  const onDelete = async (e) => {
    if (!window.confirm("¿Eliminar evento?")) return;
    try { await api.delete(`/erp/events/${e.id}`); toast.success("Eliminado"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  const empName = (id) => employees.find((e) => e.id === id)?.nombre || "—";
  const filtered = filter ? rows.filter((r) => r.estado === filter) : rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          {["", ...ESTADOS].map((e) => (
            <button key={e} onClick={() => setFilter(e)} data-testid={`evt-filter-${e || "all"}`}
              className={`px-3 py-1.5 text-xs border ${filter === e ? "border-black bg-black text-[#C5A059]" : "border-gray-300 hover:border-black"}`}>
              {e || "Todos"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-300" data-testid="evt-view-toggle">
            <button onClick={() => setView("calendar")} data-testid="evt-view-calendar"
              className={`px-3 py-1.5 text-xs flex items-center gap-1 ${view === "calendar" ? "bg-black text-[#C5A059]" : "hover:bg-gray-100"}`}>
              <LayoutGrid size={12} />Calendario
            </button>
            <button onClick={() => setView("list")} data-testid="evt-view-list"
              className={`px-3 py-1.5 text-xs flex items-center gap-1 ${view === "list" ? "bg-black text-[#C5A059]" : "hover:bg-gray-100"}`}>
              <List size={12} />Listado
            </button>
          </div>
          <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="evt-new">
            <Plus size={14} /> Nuevo evento
          </button>
        </div>
      </div>

      {view === "calendar" && (
        <CalendarView
          cursor={cursor} setCursor={setCursor}
          events={filtered} empName={empName}
          onDayClick={(d) => setEditing({ ...EMPTY, fecha: d })}
          onEventClick={(e) => setEditing(e)}
        />
      )}

      {view === "list" && (
      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3">Fecha</th><th>Hora</th><th>Cliente</th><th>Ubicación</th><th>Tipo</th><th>Empleado</th><th>Piezas</th><th className="text-right">Precio</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-gray-400">Sin eventos</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`evt-row-${r.id}`}>
                <td className="px-4 py-2"><div className="font-medium">{r.fecha}</div></td>
                <td className="text-xs text-gray-500">{r.hora_inicio?.slice(0, 5)}{r.hora_fin && `–${r.hora_fin.slice(0, 5)}`}</td>
                <td className="font-medium">{r.cliente}</td>
                <td className="text-gray-600 text-xs"><MapPin size={10} className="inline mr-1" />{r.ubicacion || "—"}</td>
                <td><span className="text-xs px-2 py-0.5 bg-gray-100">{r.tipo_servicio}</span></td>
                <td className="text-gray-600 text-xs">{empName(r.empleado_id)}</td>
                <td className="text-xs">{r.num_piezas} · {r.descripcion_piezas?.slice(0, 25)}</td>
                <td className="text-right mono">{formatMoney(r.precio_servicio)}</td>
                <td><Status estado={r.estado} /></td>
                <td className="text-right pr-2 whitespace-nowrap">
                  <button onClick={() => setEditing(r)} className="p-1.5 hover:bg-gray-100"><Pencil size={12} /></button>
                  <button onClick={() => onDelete(r)} className="p-1.5 hover:bg-red-50 text-red-600"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {editing && <Drawer initial={editing === "new" ? EMPTY : editing} isNew={editing === "new" || !editing.id} employees={employees} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const STATE_COLORS = {
  PROGRAMADO: "bg-amber-100 border-amber-300 text-amber-900",
  CONFIRMADO: "bg-blue-100 border-blue-300 text-blue-900",
  COMPLETADO: "bg-green-100 border-green-300 text-green-900",
  CANCELADO: "bg-gray-200 border-gray-300 text-gray-500 line-through",
};

function CalendarView({ cursor, setCursor, events, empName, onDayClick, onEventClick }) {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  // Semana empieza en lunes (0=Mon..6=Sun)
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      arr.push(iso);
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [y, m, startOffset, daysInMonth]);

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const e of events) {
      (map[e.fecha] = map[e.fecha] || []).push(e);
    }
    return map;
  }, [events]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const shift = (delta) => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + delta);
    setCursor(d);
  };
  const goToday = () => {
    const d = new Date(); d.setDate(1); setCursor(d);
  };

  return (
    <div className="cms-card border border-gray-200 overflow-hidden" data-testid="evt-calendar">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="p-1.5 hover:bg-gray-200" data-testid="evt-cal-prev" aria-label="Mes anterior"><ChevronLeft size={14} /></button>
          <div className="font-serif text-xl min-w-[180px] text-center">{MONTHS[m]} {y}</div>
          <button onClick={() => shift(1)} className="p-1.5 hover:bg-gray-200" data-testid="evt-cal-next" aria-label="Mes siguiente"><ChevronRight size={14} /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1 text-xs border border-gray-300 hover:border-black" data-testid="evt-cal-today">Hoy</button>
          <div className="text-xs text-gray-500">{events.length} eventos visibles</div>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-[10px] uppercase tracking-widest text-gray-500 text-center">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className="min-h-[110px] border-b border-r border-gray-100 bg-gray-50/50" />;
          const dayEvents = eventsByDay[iso] || [];
          const isToday = iso === todayIso;
          const day = Number(iso.slice(8, 10));
          return (
            <div
              key={iso}
              className={`min-h-[110px] p-1.5 border-b border-r border-gray-100 flex flex-col gap-1 hover:bg-amber-50/40 transition-colors cursor-pointer group ${isToday ? "bg-amber-50/60" : ""}`}
              onClick={() => onDayClick(iso)}
              data-testid={`evt-cal-day-${iso}`}
            >
              <div className={`flex items-center justify-between text-xs ${isToday ? "font-bold" : ""}`}>
                <span className={isToday ? "text-[#C5A059]" : "text-gray-500"}>{day}</span>
                <Plus size={10} className="opacity-0 group-hover:opacity-60" />
              </div>
              {dayEvents.slice(0, 3).map((ev) => (
                <button
                  key={ev.id}
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  data-testid={`evt-cal-item-${ev.id}`}
                  className={`text-left border-l-2 px-1.5 py-1 text-[10px] leading-tight ${STATE_COLORS[ev.estado] || "bg-gray-100"}`}
                  title={`${ev.hora_inicio ? ev.hora_inicio.slice(0, 5) + " · " : ""}${ev.cliente} · ${ev.tipo_servicio}`}
                >
                  <div className="font-medium truncate">{ev.hora_inicio?.slice(0, 5)} {ev.cliente}</div>
                  <div className="opacity-70 truncate">{empName(ev.empleado_id)}</div>
                </button>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-[10px] text-gray-500 px-1.5">+{dayEvents.length - 3} más…</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-2 border-t bg-gray-50 flex flex-wrap gap-3 text-[10px]">
        {ESTADOS.map((e) => (
          <div key={e} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 border ${STATE_COLORS[e]}`} />
            <span className="text-gray-500">{e}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Status({ estado }) {
  const colors = { PROGRAMADO: "bg-amber-100 text-amber-900", CONFIRMADO: "bg-blue-100 text-blue-900", COMPLETADO: "bg-green-100 text-green-900", CANCELADO: "bg-gray-200 text-gray-700" };
  return <span className={`text-xs px-2 py-0.5 ${colors[estado] || "bg-gray-100"}`}>{estado}</span>;
}

function Drawer({ initial, isNew, employees, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [k]: v });
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      if (isNew) await api.post("/erp/events", form);
      else await api.patch(`/erp/events/${form.id}`, form);
      toast.success("Guardado"); onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="evt-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b">
          <div className="font-serif text-2xl flex items-center gap-2"><Calendar size={20} className="text-[#C5A059]" />{form.cliente || "Servicio"}</div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <F label="Fecha *"><input type="date" required value={form.fecha} onChange={set("fecha")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Hora inicio"><input type="time" value={form.hora_inicio || ""} onChange={set("hora_inicio")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Hora fin"><input type="time" value={form.hora_fin || ""} onChange={set("hora_fin")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          </div>
          <F label="Cliente *"><input required value={form.cliente} onChange={set("cliente")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <F label="Ubicación"><input value={form.ubicacion || ""} onChange={set("ubicacion")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <div className="grid grid-cols-2 gap-4">
            <F label="Tipo">
              <select value={form.tipo_servicio} onChange={set("tipo_servicio")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
            </F>
            <F label="Estado">
              <select value={form.estado} onChange={set("estado")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">{ESTADOS.map((t) => <option key={t}>{t}</option>)}</select>
            </F>
            <F label="Empleado asignado">
              <select value={form.empleado_id || ""} onChange={set("empleado_id")} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
                <option value="">—</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </F>
            <F label="Nº piezas"><input type="number" min="0" value={form.num_piezas} onChange={set("num_piezas")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          </div>
          <F label="Descripción piezas"><input value={form.descripcion_piezas || ""} onChange={set("descripcion_piezas")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <div className="grid grid-cols-2 gap-4">
            <F label="Precio (€)"><input type="number" step="0.01" min="0" value={form.precio_servicio} onChange={set("precio_servicio")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
            <F label="Gastos (€)"><input type="number" step="0.01" min="0" value={form.gastos} onChange={set("gastos")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          </div>
          <F label="Observaciones"><textarea rows={2} value={form.observaciones || ""} onChange={set("observaciones")} className="w-full border border-gray-200 px-3 py-2 text-sm" /></F>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]">{isNew ? "Crear" : "Guardar"}</button>
        </form>
      </div>
    </div>
  );
}
function F({ label, children }) { return <div><label className="label-eyebrow text-gray-500 block mb-1">{label}</label>{children}</div>; }
