import React, { useEffect, useState } from "react";
import { MessageCircle, Save, ExternalLink } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const EMPTY = {
  whatsapp: {
    enabled: false,
    phone: "",
    default_message: "Hola, me gustaría preguntaros por…",
    label: "Chatea con nosotros",
  },
};

const normalizePhone = (v) => (v || "").replace(/[^0-9]/g, "");

export default function Configuracion() {
  const [settings, setSettings] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/settings");
        setSettings({ whatsapp: { ...EMPTY.whatsapp, ...(data.whatsapp || {}) } });
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
      };
      const { data } = await api.put("/settings", payload);
      setSettings({ whatsapp: data.whatsapp });
      toast.success("Configuración guardada");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const setWa = (patch) => setSettings((s) => ({ ...s, whatsapp: { ...s.whatsapp, ...patch } }));

  const previewHref = settings.whatsapp.phone
    ? `https://wa.me/${normalizePhone(settings.whatsapp.phone)}${
        settings.whatsapp.default_message
          ? `?text=${encodeURIComponent(settings.whatsapp.default_message)}`
          : ""
      }`
    : null;

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
