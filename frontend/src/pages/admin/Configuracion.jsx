import React, { useEffect, useState } from "react";
import { MessageCircle, Save, ExternalLink, Star, CreditCard, Mail, Send } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const EMPTY = {
  whatsapp: {
    enabled: false,
    phone: "",
    default_message: "Hola, me gustaría preguntaros por…",
    label: "Chatea con nosotros",
  },
  google: {
    enabled: false,
    place_id: "",
    business_name: "",
    write_review_url: "",
  },
};

const normalizePhone = (v) => (v || "").replace(/[^0-9]/g, "");

export default function Configuracion() {
  const [settings, setSettings] = useState(EMPTY);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/settings");
        setSettings({
          whatsapp: { ...EMPTY.whatsapp, ...(data.whatsapp || {}) },
          google: { ...EMPTY.google, ...(data.google || {}) },
        });
        setPayment(data.payment || null);
      } catch (err) {
        toast.error(formatApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        whatsapp: {
          ...settings.whatsapp,
          phone: normalizePhone(settings.whatsapp.phone),
        },
        google: { ...settings.google },
      };
      const { data } = await api.put("/settings", payload);
      setSettings({ whatsapp: data.whatsapp, google: data.google || EMPTY.google });
      toast.success("Configuración guardada");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const setWa = (patch) => setSettings((s) => ({ ...s, whatsapp: { ...s.whatsapp, ...patch } }));
  const setGoogle = (patch) => setSettings((s) => ({ ...s, google: { ...s.google, ...patch } }));

  const previewHref = settings.whatsapp.phone
    ? `https://wa.me/${normalizePhone(settings.whatsapp.phone)}${
        settings.whatsapp.default_message
          ? `?text=${encodeURIComponent(settings.whatsapp.default_message)}`
          : ""
      }`
    : null;

  const googlePreview =
    settings.google.write_review_url ||
    (settings.google.place_id
      ? `https://search.google.com/local/writereview?placeid=${settings.google.place_id}`
      : settings.google.business_name
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.google.business_name)}`
      : "");

  return (
    <div className="p-8 lg:p-10 max-w-[1100px] mx-auto" data-testid="configuracion-admin">
      <div className="mb-10">
        <div className="label-eyebrow text-gray-500">Ajustes del sitio</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1">Configuración</h1>
        <p className="text-sm text-gray-500 mt-2">
          Ajustes globales que afectan al storefront. Los cambios se publican al pulsar &quot;Guardar&quot;.
        </p>
      </div>

      {loading && <div className="text-gray-400">Cargando…</div>}

      {!loading && (
        <section className="bg-white border border-gray-200" data-testid="config-whatsapp">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <MessageCircle size={18} className="text-emerald-600" />
            <div>
              <div className="font-serif text-lg">Conexión WhatsApp</div>
              <div className="text-xs text-gray-500">
                Activa un botón flotante en el storefront que abre la conversación con tu WhatsApp Business.
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <label className="flex items-center gap-3 cursor-pointer" data-testid="config-wa-enabled">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={settings.whatsapp.enabled}
                onChange={(e) => setWa({ enabled: e.target.checked })}
              />
              <span className="text-sm">Mostrar el botón flotante de WhatsApp en el storefront</span>
            </label>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field
                label="Número de WhatsApp"
                hint="Formato internacional sin espacios ni +. Ej: 34666123456"
                required
              >
                <input
                  type="tel"
                  value={settings.whatsapp.phone}
                  onChange={(e) => setWa({ phone: e.target.value })}
                  placeholder="34666123456"
                  className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#C5A059]"
                  data-testid="config-wa-phone"
                />
              </Field>

              <Field label="Texto del botón" hint='Por ejemplo "Chatea con nosotros" o "Pídenos por WhatsApp"'>
                <input
                  type="text"
                  value={settings.whatsapp.label}
                  onChange={(e) => setWa({ label: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#C5A059]"
                  data-testid="config-wa-label"
                />
              </Field>
            </div>

            <Field label="Mensaje predefinido" hint="Texto que verá el cliente al abrir el chat. Opcional.">
              <textarea
                rows={3}
                value={settings.whatsapp.default_message}
                onChange={(e) => setWa({ default_message: e.target.value })}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#C5A059]"
                data-testid="config-wa-message"
              />
            </Field>

            {previewHref && (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between">
                <div className="text-sm text-emerald-900">
                  <div className="font-semibold mb-1">Previsualización del enlace</div>
                  <code className="text-xs break-all opacity-80">{previewHref}</code>
                </div>
                <a
                  href={previewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 text-xs uppercase tracking-widest text-emerald-700 hover:text-emerald-900 flex items-center gap-1 whitespace-nowrap"
                  data-testid="config-wa-preview"
                >
                  Probar <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button onClick={save} disabled={saving} className="ldd-btn-gold disabled:opacity-50" data-testid="config-save">
              <span className="inline-flex items-center gap-2">
                <Save size={14} /> {saving ? "Guardando…" : "Guardar configuración"}
              </span>
            </button>
          </div>
        </section>
      )}

      {!loading && (
        <section className="bg-white border border-gray-200 mt-6" data-testid="config-google">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <Star size={18} className="text-amber-500" />
            <div>
              <div className="font-serif text-lg">Reseñas en Google Maps</div>
              <div className="text-xs text-gray-500">
                Cuando un cliente publique una reseña positiva (4-5 ★) en la web, le mostraremos un aviso
                para invitarle a publicar la misma reseña en tu Ficha de Google. Todo con un solo clic.
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <label className="flex items-center gap-3 cursor-pointer" data-testid="config-google-enabled">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={settings.google.enabled}
                onChange={(e) => setGoogle({ enabled: e.target.checked })}
              />
              <span className="text-sm">Activar la invitación a publicar en Google Maps</span>
            </label>

            <Field label="Place ID (recomendado)" hint="Cógelo en https://developers.google.com/maps/documentation/places/web-service/place-id — es el más fiable.">
              <input
                type="text"
                value={settings.google.place_id || ""}
                onChange={(e) => setGoogle({ place_id: e.target.value.trim() })}
                placeholder="ChIJxxxxxxxxxxxxxxxx"
                className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#C5A059]"
                data-testid="config-google-placeid"
              />
            </Field>

            <Field label="Nombre del negocio en Google" hint="Fallback si no tienes el Place ID. Se usa para hacer una búsqueda en Maps.">
              <input
                type="text"
                value={settings.google.business_name || ""}
                onChange={(e) => setGoogle({ business_name: e.target.value })}
                placeholder="Las Dos Doncellas Ibéricos Sevilla"
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#C5A059]"
                data-testid="config-google-name"
              />
            </Field>

            <Field label="URL directa (opcional, sobrescribe todo)" hint="Si ya tienes el enlace generado de 'Escribir una reseña', pégalo aquí.">
              <input
                type="url"
                value={settings.google.write_review_url || ""}
                onChange={(e) => setGoogle({ write_review_url: e.target.value.trim() })}
                placeholder="https://g.page/r/xxxxxxxx/review"
                className="w-full border border-gray-300 px-3 py-2 font-mono text-xs focus:outline-none focus:border-[#C5A059]"
                data-testid="config-google-url"
              />
            </Field>

            {googlePreview && (
              <div className="rounded border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
                <div className="text-sm text-amber-900">
                  <div className="font-semibold mb-1">Enlace que verá el cliente</div>
                  <code className="text-xs break-all opacity-80">{googlePreview}</code>
                </div>
                <a
                  href={googlePreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 text-xs uppercase tracking-widest text-amber-700 hover:text-amber-900 flex items-center gap-1 whitespace-nowrap"
                  data-testid="config-google-preview"
                >
                  Probar <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button onClick={save} disabled={saving} className="ldd-btn-gold disabled:opacity-50" data-testid="config-save-google">
              <span className="inline-flex items-center gap-2">
                <Save size={14} /> {saving ? "Guardando…" : "Guardar configuración"}
              </span>
            </button>
          </div>
        </section>
      )}

      {payment && (
        <section className="bg-white border border-gray-200 mt-6" data-testid="config-payment">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <CreditCard size={18} className="text-blue-600" />
            <div>
              <div className="font-serif text-lg">Pasarela de pago</div>
              <div className="text-xs text-gray-500">
                Configurada vía variables de entorno del backend por seguridad. Para cambiar
                credenciales, actualiza <code>backend/.env</code> y reinicia el servidor.
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoRow label="Proveedor" value={payment.provider === "redsys" ? "CaixaBank · Redsys" : payment.provider} />
            <InfoRow label="Entorno"
                     value={payment.redsys_environment}
                     badge={payment.redsys_environment === "production" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"} />
            <InfoRow label="Número de comercio" value={payment.redsys_merchant_code || "—"} mono />
            <InfoRow label="Terminal" value={payment.redsys_terminal || "—"} mono />
            <InfoRow label="Moneda" value="EUR (978)" />
            <InfoRow label="Endpoint notificación"
                     value="/api/payments/redsys/notify"
                     mono
                     hint="Redsys debe apuntar aquí en Ds_Merchant_MerchantURL" />
          </div>
          {payment.redsys_environment === "test" && (
            <div className="mx-6 mb-6 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Modo pruebas activo.</strong> Los cobros no se cargan al cliente. Cuando el TPV
              esté validado por CaixaBank, cambia <code>REDSYS_ENDPOINT</code> a
              <code> https://sis.redsys.es/sis/realizarPago</code> y actualiza clave/comercio con los
              datos definitivos.
            </div>
          )}
        </section>
      )}

      <EmailSection />
    </div>
  );
}

const PROVIDER_LABEL = {
  relay: "Correo del hosting (relé seguro)",
  smtp: "SMTP del hosting",
  brevo: "Brevo",
  none: "No configurado",
};

function EmailSection() {
  const [status, setStatus] = useState(null);
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    api.get("/settings/email").then((r) => setStatus(r.data)).catch(() => setStatus(null));
  }, []);
  const sendTest = async (e) => {
    e.preventDefault();
    if (!to) return;
    setSending(true);
    try {
      const { data } = await api.post("/settings/email/test", { to });
      if (data.sent) toast.success(`Correo de prueba enviado a ${to}`);
      else toast.error(data.reason || "No se pudo enviar el correo de prueba");
    } catch (err) { toast.error(formatApiError(err)); } finally { setSending(false); }
  };
  if (!status) return null;
  const ok = status.provider !== "none";
  return (
    <section className="bg-white border border-gray-200 mt-6" data-testid="config-email">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
        <Mail size={18} className="text-blue-600" />
        <div>
          <div className="font-serif text-lg">Correo transaccional</div>
          <div className="text-xs text-gray-500">
            Confirmaciones de pedido, verificación de cuenta, recuperación de contraseña y avisos a tienda.
          </div>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoRow label="Estado" value={ok ? "Activo" : "Inactivo"} badge={ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} />
        <InfoRow label="Proveedor" value={PROVIDER_LABEL[status.provider] || status.provider} />
        <InfoRow label="Remitente" value={status.from_email || "—"} mono />
      </div>
      <form onSubmit={sendTest} className="px-6 pb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="label-eyebrow text-gray-500 text-[10px] block mb-1">Enviar correo de prueba a</label>
          <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} placeholder="tu@email.com"
                 className="w-full border border-gray-300 px-3 py-2 text-sm" data-testid="email-test-to" />
        </div>
        <button disabled={sending || !ok} className="px-4 py-2 bg-black text-white text-xs uppercase tracking-widest disabled:opacity-50 flex items-center gap-2" data-testid="email-test-send">
          <Send size={12} /> {sending ? "Enviando…" : "Enviar prueba"}
        </button>
      </form>
    </section>
  );
}

function InfoRow({ label, value, mono, badge, hint }) {
  return (
    <div className="border border-gray-200 p-3">
      <div className="label-eyebrow text-gray-500 text-[10px]">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-sm" : "text-sm"}`}>
        {badge ? <span className={`inline-block px-2 py-0.5 text-xs ${badge}`}>{value}</span> : value}
      </div>
      {hint && <div className="text-[10px] text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

function Field({ label, children, required, hint }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-gray-500 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}
