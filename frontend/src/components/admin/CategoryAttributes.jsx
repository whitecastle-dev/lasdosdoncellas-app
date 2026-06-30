import React from "react";

// Opciones predefinidas para los campos de Jamones / Paletillas / Quesos
const JAMON_WEIGHTS = ["7-8 kg", "8-9 kg", "9-10 kg"];
const JAMON_CUTS = [
  { value: "pieza", label: "Pieza entera" },
  { value: "a-mano", label: "Cortado a mano" },
  { value: "deshuesado", label: "Deshuesado" },
];
const JAMON_CURING = [
  { value: "tierno", label: "Tierno · poco a poco" },
  { value: "punto", label: "En su punto · eventos" },
  { value: "intenso", label: "Muy curado · sabor intenso" },
];

const MILK_ORIGIN = ["Cabra", "Oveja", "Vaca", "Mezcla"];
const MILK_TYPE = ["Cruda", "Pasteurizada", "Sin lactosa"];

const EMBUTIDOS_FORMATS = [
  { value: "pieza-entera", label: "Pieza entera" },
  { value: "media-pieza", label: "Media pieza" },
];

/**
 * Pinta campos específicos en función del slug de la categoría seleccionada
 * para el producto que se está editando. Si el slug no es uno de los
 * "especiales", no pinta nada — quedando la UI igual que antes.
 *
 * Los datos se guardan dentro de `form.attributes` (objeto libre) excepto
 * para vinos donde el maridaje va en `attributes.paired_cheese_ids`.
 */
export default function CategoryAttributes({ form, setForm, categorySlug, allCheeses = [] }) {
  if (!categorySlug) return null;
  const attrs = form.attributes || {};
  const setAttr = (k, v) => setForm({ ...form, attributes: { ...attrs, [k]: v } });

  if (categorySlug === "jamones" || categorySlug === "paletillas") {
    return (
      <fieldset className="border border-gray-200 p-5 bg-amber-50/40" data-testid="prod-attrs-jamones">
        <legend className="px-2 text-xs uppercase tracking-widest text-amber-900">Atributos · {categorySlug === "jamones" ? "Jamón" : "Paletilla"}</legend>
        <p className="text-xs text-gray-500 -mt-2 mb-4">
          Estos campos definen los criterios que el cliente combinará al elegir. Usa la tabla de Variantes para fijar el precio de cada combinación.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <SelectField label="Peso (kg)" value={attrs.weight_kg || ""} onChange={(v) => setAttr("weight_kg", v)} options={JAMON_WEIGHTS} testid="attr-jamon-weight" />
          <SelectField label="Tipo de corte" value={attrs.cut_type || ""} onChange={(v) => setAttr("cut_type", v)} options={JAMON_CUTS} testid="attr-jamon-cut" />
          <SelectField label="Punto de curación" value={attrs.curing_level || ""} onChange={(v) => setAttr("curing_level", v)} options={JAMON_CURING} testid="attr-jamon-curing" />
        </div>
      </fieldset>
    );
  }

  if (categorySlug === "quesos") {
    return (
      <fieldset className="border border-gray-200 p-5 bg-yellow-50/40" data-testid="prod-attrs-quesos">
        <legend className="px-2 text-xs uppercase tracking-widest text-yellow-900">Atributos · Queso</legend>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <I label="Peso (g)" type="number" value={form.weight_grams || ""} onChange={(e) => setForm({ ...form, weight_grams: e.target.value === "" ? 0 : Number(e.target.value) })} testid="attr-queso-weight" />
          <I label="Denominación de Origen" value={attrs.denominacion_origen || ""} onChange={(e) => setAttr("denominacion_origen", e.target.value)} placeholder="ej. Payoyo, Manchego" testid="attr-queso-do" />
          <SelectField label="Origen de la leche" value={attrs.milk_origin || ""} onChange={(v) => setAttr("milk_origin", v)} options={MILK_ORIGIN} testid="attr-queso-milk-origin" />
          <SelectField label="Tipo de leche" value={attrs.milk_type || ""} onChange={(v) => setAttr("milk_type", v)} options={MILK_TYPE} testid="attr-queso-milk-type" />
        </div>
      </fieldset>
    );
  }

  if (categorySlug === "embutidos") {
    return (
      <fieldset className="border border-gray-200 p-5 bg-red-50/40" data-testid="prod-attrs-embutidos">
        <legend className="px-2 text-xs uppercase tracking-widest text-red-900">Atributos · Embutido</legend>
        <p className="text-xs text-gray-500 -mt-2 mb-4">
          Para vender el mismo embutido en dos formatos (pieza entera y media pieza), añade dos variantes con su propio precio en la sección de abajo.
        </p>
        <SelectField label="Formato por defecto" value={attrs.format || ""} onChange={(v) => setAttr("format", v)} options={EMBUTIDOS_FORMATS} testid="attr-embutido-format" />
      </fieldset>
    );
  }

  if (categorySlug === "vinos" || categorySlug === "vino-granel" || categorySlug === "bebidas-alcoholicas") {
    const paired = attrs.paired_cheese_ids || [];
    const toggle = (id) => {
      const next = paired.includes(id) ? paired.filter((x) => x !== id) : [...paired, id];
      setAttr("paired_cheese_ids", next);
    };
    return (
      <fieldset className="border border-gray-200 p-5 bg-purple-50/40" data-testid="prod-attrs-vinos">
        <legend className="px-2 text-xs uppercase tracking-widest text-purple-900">Atributos · {categorySlug === "vinos" ? "Vino" : (categorySlug === "vino-granel" ? "Vino Granel" : "Bebida Alcohólica")}</legend>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-gray-500 mb-1">Recomendación de maridaje (texto)</span>
            <textarea
              rows={2}
              value={attrs.pairing_text || ""}
              onChange={(e) => setAttr("pairing_text", e.target.value)}
              placeholder="ej. Marida bien con quesos curados de oveja y embutidos ibéricos."
              className="w-full border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#C5A059] text-sm"
              data-testid="attr-vino-pairing-text"
            />
          </label>
          <div>
            <span className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Quesos sugeridos para maridaje ({paired.length})</span>
            {allCheeses.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No hay quesos en el catálogo para sugerir. Crea quesos primero.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-gray-200 bg-white p-2 space-y-1">
                {allCheeses.map((q) => (
                  <label key={q.id} className="flex items-center gap-2 text-sm py-1 px-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paired.includes(q.id)}
                      onChange={() => toggle(q.id)}
                      data-testid={`attr-vino-pair-${q.id}`}
                    />
                    <span>{q.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </fieldset>
    );
  }

  return null;
}

function SelectField({ label, value, onChange, options, testid }) {
  const opts = options.map((o) => typeof o === "string" ? { value: o, label: o } : o);
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-gray-500 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:border-[#C5A059] bg-white"
        data-testid={testid}
      >
        <option value="">—</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function I({ label, testid, placeholder, ...rest }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-gray-500 mb-1">{label}</span>
      <input {...rest} placeholder={placeholder} className="w-full border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:border-[#C5A059]" data-testid={testid} />
    </label>
  );
}
