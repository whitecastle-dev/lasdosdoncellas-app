import React, { useEffect, useState } from "react";
import { X, ExternalLink, Mail, Phone, MapPin, Building2, User, Package, Truck } from "lucide-react";
import { api, formatMoney, fileUrl } from "@/lib/api";
import { Link } from "react-router-dom";

/**
 * Modal reutilizable para mostrar una entidad relacionada en el CMS.
 * Se invoca con tipo + id. Soporta: web-customer, business-customer,
 * provider, product.
 *
 * Uso: <RelationModal type="provider" id={provider_id} onClose={...} />
 */
export default function RelationModal({ type, id, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!type || !id) return;
    let url = null;
    if (type === "web-customer") url = `/users/web/${id}`;
    else if (type === "business-customer") url = `/business-customers/${id}`;
    else if (type === "provider") url = `/providers/${id}`;
    else if (type === "product") url = `/products/${id}`;
    if (!url) return;
    setData(null); setError(null);
    api.get(url).then((r) => setData(r.data)).catch((e) => setError(e?.response?.data?.detail || "No se pudo cargar"));
  }, [type, id]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid={`relation-modal-${type}`}
      >
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Header type={type} data={data} />
          </div>
          <button onClick={onClose} data-testid="relation-modal-close" className="p-1 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {!data && !error && <div className="text-gray-400 text-sm">Cargando…</div>}
          {data && type === "web-customer" && <WebCustomerView c={data} />}
          {data && type === "business-customer" && <BusinessCustomerView b={data} />}
          {data && type === "provider" && <ProviderView p={data} />}
          {data && type === "product" && <ProductView p={data} />}
        </div>
      </div>
    </div>
  );
}

function Header({ type, data }) {
  const icons = { "web-customer": User, "business-customer": Building2, "provider": Truck, "product": Package };
  const labels = { "web-customer": "Cliente web", "business-customer": "Cliente empresa", "provider": "Proveedor", "product": "Producto" };
  const Icon = icons[type] || User;
  return (
    <div>
      <div className="label-eyebrow text-gray-500">{labels[type]}</div>
      <div className="font-serif text-xl flex items-center gap-2 mt-0.5">
        <Icon size={18} className="text-[#C5A059]" />
        {data ? (data.company_name || data.name || `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.email || "—") : "…"}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 text-sm py-1.5">
      {Icon && <Icon size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />}
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider text-gray-400">{label}</div>
        <div className="text-gray-800 mt-0.5 break-words">{children || "—"}</div>
      </div>
    </div>
  );
}

function WebCustomerView({ c }) {
  const addr = (c.addresses || [])[0] || {};
  const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.name || c.email;
  return (
    <div className="space-y-1">
      <Row icon={User} label="Nombre">{fullName}</Row>
      <Row icon={Mail} label="Email">{c.email}</Row>
      <Row icon={Phone} label="Teléfono">{c.phone}</Row>
      <Row icon={MapPin} label="Dirección">
        {[addr.address, addr.postal_code, addr.city, addr.country].filter(Boolean).join(", ") || "—"}
      </Row>
      <Row label="Estado">
        <span className={`text-xs px-2 py-0.5 ${c.is_verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
          {c.is_verified ? "Verificado" : "Pendiente verificación"}
        </span>
      </Row>
      <Row label="Alta">{c.created_at ? new Date(c.created_at).toLocaleString("es-ES") : "—"}</Row>
    </div>
  );
}

function BusinessCustomerView({ b }) {
  return (
    <div className="space-y-1">
      <Row icon={Building2} label="Razón social">{b.company_name}</Row>
      <Row label="CIF/NIF"><span className="mono">{b.tax_id}</span></Row>
      <Row icon={User} label="Persona de contacto">{b.contact_name}</Row>
      <Row icon={Mail} label="Email">{b.email}</Row>
      <Row icon={Phone} label="Teléfono">{b.phone}</Row>
      <Row icon={MapPin} label="Dirección fiscal">
        {[b.address, b.postal_code, b.city, b.country].filter(Boolean).join(", ") || "—"}
      </Row>
      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-400">Descuento</div>
          <div className="font-serif text-2xl text-green-700">−{b.discount_pct || 0}%</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-400">Pago</div>
          <div className="font-medium mt-1">{b.payment_terms || "Contado"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-400">Crédito</div>
          <div className="font-medium mt-1">{b.credit_limit ? formatMoney(b.credit_limit) : "Sin límite"}</div>
        </div>
      </div>
      {b.notes && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Notas internas</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{b.notes}</div>
        </div>
      )}
    </div>
  );
}

function ProviderView({ p }) {
  return (
    <div className="space-y-1">
      <Row icon={Truck} label="Nombre">{p.name}</Row>
      <Row icon={Building2} label="Empresa">{p.company}</Row>
      <Row icon={User} label="Persona de contacto">{p.contact_name}</Row>
      <Row icon={Mail} label="Email">{p.email}</Row>
      <Row icon={Phone} label="Teléfono">{p.phone}</Row>
      <Row label="CIF/NIF"><span className="mono">{p.tax_id}</span></Row>
      <Row icon={MapPin} label="Dirección">
        {[p.address, p.postal_code, p.city, p.country].filter(Boolean).join(", ") || "—"}
      </Row>
      <Row label="Condiciones de pago">{p.payment_terms}</Row>
      {p.notes && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Notas</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{p.notes}</div>
        </div>
      )}
    </div>
  );
}

function ProductView({ p }) {
  const img = (p.images && p.images[0]) || p.image_url;
  const imgSrc = !img ? null : img.startsWith("http") ? img : fileUrl(img);
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {imgSrc ? (
          <img src={imgSrc} alt={p.name} className="w-28 h-28 object-cover border border-gray-200" />
        ) : (
          <div className="w-28 h-28 bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
            <Package size={24} />
          </div>
        )}
        <div className="flex-1">
          <div className="font-serif text-lg">{p.name}</div>
          <div className="text-xs text-gray-500 mono mt-1">SKU {p.sku}</div>
          <div className="font-serif text-2xl mt-2">{formatMoney(p.price)}</div>
          {p.compare_at_price > 0 && p.compare_at_price > p.price && (
            <div className="text-xs text-gray-400 line-through">{formatMoney(p.compare_at_price)}</div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
        <Row label="Stock">{p.stock} uds</Row>
        <Row label="IVA">{p.vat_rate}%</Row>
        <Row label="Estado">
          <span className={`text-xs px-2 py-0.5 ${p.is_active ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
            {p.is_active ? "Activo" : "Oculto"}
          </span>
        </Row>
      </div>
      {p.description && (
        <div className="pt-3 border-t border-gray-100">
          <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Descripción</div>
          <div className="text-sm text-gray-700">{p.description}</div>
        </div>
      )}
      <div className="pt-3 border-t border-gray-100">
        <Link to={`/product/${p.id}`} target="_blank" className="text-sm gold hover:underline inline-flex items-center gap-1">
          Ver en la tienda <ExternalLink size={12} />
        </Link>
      </div>
    </div>
  );
}
