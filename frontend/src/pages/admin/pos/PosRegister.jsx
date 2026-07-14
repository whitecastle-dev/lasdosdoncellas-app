import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  Search,
  Lock,
  Unlock,
  CreditCard,
  Banknote,
  Wallet,
  Receipt,
  Trash2,
} from "lucide-react";

const VAT_DEFAULT = 10;

export default function PosRegister() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]); // {product_id?, sku, name, qty, unit_price}
  const [method, setMethod] = useState("efectivo");
  const [efectivo, setEfectivo] = useState(0);
  const [tarjeta, setTarjeta] = useState(0);
  const [vatPct, setVatPct] = useState(VAT_DEFAULT);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [closeDrawer, setCloseDrawer] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);

  const loadSession = async () => {
    try {
      const r = await api.get("/pos/sessions/active");
      setSession(r.data && r.data.id ? r.data : null);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const r = await api.get("/products");
      setProducts(Array.isArray(r.data) ? r.data : r.data.items || []);
    } catch (err) {
      /* ignore */
    }
  };

  useEffect(() => {
    loadSession();
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 24);
    return products
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          (p.variants || []).some((v) => v.sku?.toLowerCase().includes(q))
      )
      .slice(0, 24);
  }, [products, query]);

  const addProduct = (p, variant) => {
    const sku = variant?.sku || p.sku || "";
    const price = variant?.price ?? p.price ?? 0;
    const name = variant ? `${p.name} · ${variant.label || variant.name || ""}` : p.name;
    const idx = cart.findIndex((c) => c.product_id === p.id && c.sku === sku);
    if (idx >= 0) {
      const next = [...cart];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      setCart(next);
    } else {
      setCart([...cart, { product_id: p.id, sku, name, qty: 1, unit_price: Number(price) }]);
    }
  };

  const updateLine = (i, patch) => {
    const next = [...cart];
    next[i] = { ...next[i], ...patch };
    setCart(next);
  };
  const removeLine = (i) => setCart(cart.filter((_, idx) => idx !== i));

  const addManualLine = () =>
    setCart([...cart, { product_id: null, sku: "", name: "Artículo libre", qty: 1, unit_price: 0 }]);

  const subtotal = cart.reduce((s, l) => s + Number(l.qty) * Number(l.unit_price), 0);
  const vat = subtotal * (vatPct / 100);
  const total = subtotal + vat;
  const pagado = Number(efectivo || 0) + Number(tarjeta || 0);
  const cambio = pagado - total;

  const clear = () => {
    setCart([]);
    setEfectivo(0);
    setTarjeta(0);
    setMethod("efectivo");
  };

  const cobrar = async () => {
    if (!session) return toast.error("Abre una sesión de caja primero");
    if (cart.length === 0) return toast.error("Añade artículos");
    if (pagado + 0.01 < total) return toast.error("Falta importe por cobrar");
    try {
      const r = await api.post("/pos/tickets", {
        items: cart.map((l) => ({
          product_id: l.product_id,
          sku: l.sku,
          name: l.name,
          qty: Number(l.qty),
          unit_price: Number(l.unit_price),
        })),
        metodo_pago: method,
        efectivo: method === "tarjeta" ? 0 : Number(efectivo || 0),
        tarjeta: method === "efectivo" ? 0 : Number(tarjeta || 0),
        vat_pct: vatPct,
      });
      toast.success(`Ticket ${r.data.ticket.numero} · ${formatMoney(r.data.ticket.total)}`);
      setLastTicket(r.data.ticket);
      clear();
      loadSession();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando…</div>;

  if (!session) {
    return (
      <div className="cms-card border border-gray-200 p-10 text-center max-w-xl mx-auto">
        <Lock size={40} className="mx-auto text-gray-400 mb-4" />
        <div className="font-serif text-2xl mb-2">No hay sesión de caja abierta</div>
        <div className="text-sm text-gray-500 mb-6">
          Abre una sesión indicando la cuenta de caja y el saldo de apertura para empezar a cobrar tickets.
        </div>
        <button
          data-testid="pos-open-session-btn"
          onClick={() => setOpenDrawer(true)}
          className="px-5 py-2.5 bg-black text-[#C5A059] inline-flex items-center gap-2"
        >
          <Unlock size={16} /> Abrir sesión de caja
        </button>
        {openDrawer && <OpenSessionDrawer onClose={() => setOpenDrawer(false)} onOpened={() => { setOpenDrawer(false); loadSession(); }} />}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* LEFT: catálogo */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto por nombre o SKU…"
              className="w-full pl-10 pr-3 py-2.5 border border-gray-200 text-sm"
              data-testid="pos-search"
            />
          </div>
          <button
            onClick={addManualLine}
            className="px-3 py-2 border border-gray-300 text-xs flex items-center gap-1 hover:border-black"
            data-testid="pos-add-manual"
          >
            <Plus size={12} /> Artículo libre
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="pos-catalog">
          {filtered.map((p) => {
            const variants = p.variants || [];
            if (variants.length > 1) {
              return variants.map((v) => (
                <button
                  key={`${p.id}-${v.sku || v.label}`}
                  onClick={() => addProduct(p, v)}
                  className="cms-card border border-gray-200 p-3 text-left hover:border-black"
                  data-testid={`pos-item-${p.id}-${v.sku || v.label}`}
                >
                  <div className="text-xs text-gray-400 mono truncate">{v.sku || "—"}</div>
                  <div className="text-sm font-medium leading-tight line-clamp-2 mt-0.5">{p.name}</div>
                  <div className="text-xs text-gray-500">{v.label || v.name}</div>
                  <div className="mt-2 font-serif text-lg">{formatMoney(v.price ?? p.price ?? 0)}</div>
                </button>
              ));
            }
            const v = variants[0];
            const price = v?.price ?? p.price ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => addProduct(p, v)}
                className="cms-card border border-gray-200 p-3 text-left hover:border-black"
                data-testid={`pos-item-${p.id}`}
              >
                <div className="text-xs text-gray-400 mono truncate">{v?.sku || p.sku || "—"}</div>
                <div className="text-sm font-medium leading-tight line-clamp-2 mt-0.5">{p.name}</div>
                <div className="mt-2 font-serif text-lg">{formatMoney(price)}</div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-400 text-sm">Sin resultados.</div>
          )}
        </div>
      </div>

      {/* RIGHT: cart + cobro */}
      <div className="lg:col-span-2 space-y-3">
        <div className="cms-card border border-gray-200">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="text-xs mono text-gray-500">Sesión {session.numero}</div>
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800">abierta</span>
            </div>
            <button
              onClick={() => setCloseDrawer(true)}
              className="text-xs text-gray-500 hover:text-black flex items-center gap-1"
              data-testid="pos-close-session-btn"
            >
              <Lock size={12} /> Cerrar caja
            </button>
          </div>
          <div className="max-h-[45vh] overflow-y-auto" data-testid="pos-cart">
            {cart.length === 0 && (
              <div className="py-10 text-center text-gray-400 text-sm">
                Selecciona productos del catálogo…
              </div>
            )}
            {cart.map((l, i) => (
              <div key={i} className="px-4 py-3 border-b last:border-0 flex items-center gap-2" data-testid={`pos-cart-line-${i}`}>
                <div className="flex-1 min-w-0">
                  {l.product_id ? (
                    <div className="text-sm truncate">{l.name}</div>
                  ) : (
                    <input
                      value={l.name}
                      onChange={(e) => updateLine(i, { name: e.target.value })}
                      className="w-full border-b border-gray-200 text-sm py-0.5"
                      placeholder="Descripción"
                    />
                  )}
                  <div className="text-xs text-gray-400 mono">{l.sku || (l.product_id ? "—" : "libre")}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateLine(i, { qty: Math.max(0.1, Number(l.qty) - 1) })} className="w-6 h-6 border border-gray-200 flex items-center justify-center hover:border-black">
                    <Minus size={10} />
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={l.qty}
                    onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                    className="w-14 border border-gray-200 px-1 py-1 text-center text-sm"
                  />
                  <button onClick={() => updateLine(i, { qty: Number(l.qty) + 1 })} className="w-6 h-6 border border-gray-200 flex items-center justify-center hover:border-black">
                    <Plus size={10} />
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={l.unit_price}
                  onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })}
                  className="w-20 border border-gray-200 px-2 py-1 text-right text-sm"
                />
                <div className="w-16 text-right font-serif text-sm">{formatMoney(l.qty * l.unit_price)}</div>
                <button onClick={() => removeLine(i)} className="p-1 text-red-600 hover:bg-red-50">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t bg-gray-50 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <div className="flex justify-between text-gray-500">
              <span>IVA
                <select value={vatPct} onChange={(e) => setVatPct(Number(e.target.value))} className="ml-2 border border-gray-200 bg-white px-1 text-xs">
                  <option value={0}>0%</option>
                  <option value={4}>4%</option>
                  <option value={10}>10%</option>
                  <option value={21}>21%</option>
                </select>
              </span>
              <span>{formatMoney(vat)}</span>
            </div>
            <div className="flex justify-between font-serif text-2xl border-t pt-2" data-testid="pos-total">
              <span>Total</span><span>{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="cms-card border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["efectivo", "Efectivo", Banknote],
              ["tarjeta", "Tarjeta", CreditCard],
              ["mixto", "Mixto", Wallet],
            ].map(([v, l, Icon]) => (
              <button
                key={v}
                onClick={() => {
                  setMethod(v);
                  if (v === "tarjeta") { setEfectivo(0); setTarjeta(total); }
                  if (v === "efectivo") { setTarjeta(0); setEfectivo(Math.max(total, Number(efectivo) || total)); }
                }}
                className={`p-3 border text-xs flex flex-col items-center gap-1 ${
                  method === v ? "border-black bg-black text-[#C5A059]" : "border-gray-300 hover:border-black"
                }`}
                data-testid={`pos-method-${v}`}
              >
                <Icon size={16} />
                {l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="label-eyebrow text-gray-500 mb-1">Efectivo €</div>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={method === "tarjeta"}
                value={efectivo}
                onChange={(e) => setEfectivo(Number(e.target.value))}
                className="w-full border border-gray-200 px-3 py-2 text-lg font-serif disabled:bg-gray-100"
                data-testid="pos-efectivo"
              />
            </div>
            <div>
              <div className="label-eyebrow text-gray-500 mb-1">Tarjeta €</div>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={method === "efectivo"}
                value={tarjeta}
                onChange={(e) => setTarjeta(Number(e.target.value))}
                className="w-full border border-gray-200 px-3 py-2 text-lg font-serif disabled:bg-gray-100"
                data-testid="pos-tarjeta"
              />
            </div>
          </div>
          <div className={`flex justify-between text-sm ${cambio < 0 ? "text-red-600" : "text-gray-600"}`}>
            <span>{cambio < 0 ? "Falta" : "Cambio"}</span>
            <span className="font-serif">{formatMoney(Math.abs(cambio))}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clear}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-sm hover:border-black"
              data-testid="pos-clear"
            >
              Cancelar
            </button>
            <button
              onClick={cobrar}
              disabled={cart.length === 0 || pagado + 0.01 < total}
              className="flex-[2] px-4 py-2.5 bg-black text-[#C5A059] text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              data-testid="pos-cobrar"
            >
              <Receipt size={14} /> Cobrar {formatMoney(total)}
            </button>
          </div>
        </div>

        {lastTicket && (
          <div className="cms-card border border-green-300 bg-green-50 p-4 text-sm" data-testid="pos-last-ticket">
            <div className="font-medium text-green-800 mb-1">Último ticket: {lastTicket.numero}</div>
            <div className="text-xs text-green-700">
              Total {formatMoney(lastTicket.total)} · {lastTicket.metodo_pago} · Cambio {formatMoney(lastTicket.cambio)}
            </div>
          </div>
        )}
      </div>

      {closeDrawer && (
        <CloseSessionDrawer
          session={session}
          onClose={() => setCloseDrawer(false)}
          onClosed={() => {
            setCloseDrawer(false);
            loadSession();
          }}
        />
      )}
    </div>
  );
}

function OpenSessionDrawer({ onClose, onOpened }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ account_id: "", saldo_apertura: 0, empleado_nombre: "" });
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/treasury/accounts");
        const caja = r.data.filter((a) => a.tipo === "cash" && a.activo);
        const all = r.data.filter((a) => a.activo);
        setAccounts(caja.length ? caja : all);
        if (caja.length) setForm((f) => ({ ...f, account_id: caja[0].id }));
        else if (all.length) setForm((f) => ({ ...f, account_id: all[0].id }));
      } catch (err) {
        toast.error(formatApiError(err));
      }
    })();
  }, []);
  const save = async (e) => {
    e.preventDefault();
    if (!form.account_id) return toast.error("Selecciona cuenta de caja");
    try {
      await api.post("/pos/sessions/open", form);
      toast.success("Sesión abierta");
      onOpened();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white" onClick={(e) => e.stopPropagation()} data-testid="pos-open-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b">
          <div className="font-serif text-2xl flex items-center gap-2">
            <Unlock size={20} className="text-[#C5A059]" />Abrir caja
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Cuenta de caja *</label>
            <select
              required
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              className="w-full border border-gray-200 px-3 py-2 text-sm bg-white"
              data-testid="pos-open-account"
            >
              <option value="">— seleccionar —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.tipo === "cash" ? "caja" : "banco"})
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <div className="text-xs text-red-600 mt-1">
                No hay cuentas activas. Crea una en Tesorería → Cuentas.
              </div>
            )}
          </div>
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Saldo apertura €</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.saldo_apertura}
              onChange={(e) => setForm({ ...form, saldo_apertura: Number(e.target.value) })}
              className="w-full border border-gray-200 px-3 py-2 text-sm"
              data-testid="pos-open-saldo"
            />
          </div>
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Responsable / empleado</label>
            <input
              value={form.empleado_nombre}
              onChange={(e) => setForm({ ...form, empleado_nombre: e.target.value })}
              className="w-full border border-gray-200 px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]" data-testid="pos-open-save">
            Abrir sesión
          </button>
        </form>
      </div>
    </div>
  );
}

function CloseSessionDrawer({ session, onClose, onClosed }) {
  const [saldoContado, setSaldoContado] = useState(
    (session.saldo_apertura || 0) + (session.total_ventas || 0)
  );
  const esperado = (session.saldo_apertura || 0) + (session.total_ventas || 0);
  const diff = Number(saldoContado) - esperado;
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/pos/sessions/${session.id}/close`, { saldo_cierre_contado: Number(saldoContado) });
      toast.success("Caja cerrada");
      onClosed();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white" onClick={(e) => e.stopPropagation()} data-testid="pos-close-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b">
          <div className="font-serif text-2xl flex items-center gap-2">
            <Lock size={20} className="text-[#C5A059]" />Cierre de caja
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Apertura" value={formatMoney(session.saldo_apertura)} />
            <Stat label="Tickets" value={session.num_tickets || 0} />
            <Stat label="Ventas" value={formatMoney(session.total_ventas)} />
            <Stat label="Esperado" value={formatMoney(esperado)} highlight />
          </div>
          <div>
            <label className="label-eyebrow text-gray-500 block mb-1">Saldo contado €</label>
            <input
              type="number"
              step="0.01"
              value={saldoContado}
              onChange={(e) => setSaldoContado(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-lg font-serif"
              data-testid="pos-close-saldo"
            />
          </div>
          <div className={`text-sm ${Math.abs(diff) < 0.01 ? "text-green-700" : diff > 0 ? "text-blue-700" : "text-red-700"}`}>
            Diferencia: <strong className="font-serif">{formatMoney(diff)}</strong>
          </div>
          <button type="submit" className="px-5 py-2.5 bg-black text-[#C5A059]" data-testid="pos-close-save">
            Cerrar caja
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`p-3 border ${highlight ? "border-black" : "border-gray-200"}`}>
      <div className="label-eyebrow text-gray-500">{label}</div>
      <div className="font-serif text-lg">{value}</div>
    </div>
  );
}
