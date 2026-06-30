import React from "react";
import { Plus, X } from "lucide-react";

/**
 * Editor genérico de variantes — vale para CUALQUIER producto.
 * Cada variante tiene su etiqueta visible y su propio precio.
 * El admin no necesita crear N productos para N formatos.
 */
export default function VariantsEditor({ variants, onChange }) {
  const add = () =>
    onChange([...(variants || []), { label: "", price: 0, compare_at_price: 0, stock: null, sku_suffix: "", attributes: {} }]);

  const update = (idx, patch) => {
    const next = (variants || []).slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx) => onChange((variants || []).filter((_, i) => i !== idx));

  return (
    <fieldset className="border border-gray-200 p-5 bg-gray-50" data-testid="prod-variants">
      <legend className="px-2 text-xs uppercase tracking-widest text-gray-600">Variantes / Formatos</legend>
      <p className="text-xs text-gray-500 -mt-2 mb-4">
        Si vendes el mismo producto en varias presentaciones (peso, formato, corte…), créalo una vez y añade aquí cada variante con su precio. El cliente las elegirá en la ficha del producto.
      </p>
      {(variants || []).length === 0 && (
        <p className="text-xs text-gray-400 italic mb-3">Sin variantes (se usará solo el precio base del producto).</p>
      )}
      {(variants || []).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-gray-500">
                <th className="text-left py-2 font-normal">Etiqueta</th>
                <th className="text-right py-2 font-normal w-28">Precio</th>
                <th className="text-right py-2 font-normal w-28">P. compar.</th>
                <th className="text-right py-2 font-normal w-20">Stock</th>
                <th className="text-left py-2 font-normal w-24">SKU suffix</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={i} className="border-t border-gray-200" data-testid={`prod-variant-row-${i}`}>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={v.label || ""}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder='ej. "Pieza entera 8-9kg · Tierno"'
                      className="w-full border border-gray-300 px-2 py-1 focus:outline-none focus:border-[#C5A059]"
                      data-testid={`prod-variant-label-${i}`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number" step="0.01"
                      value={v.price || ""}
                      onChange={(e) => update(i, { price: e.target.value })}
                      className="w-full border border-gray-300 px-2 py-1 text-right tabular-nums"
                      data-testid={`prod-variant-price-${i}`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number" step="0.01"
                      value={v.compare_at_price || ""}
                      onChange={(e) => update(i, { compare_at_price: e.target.value })}
                      className="w-full border border-gray-300 px-2 py-1 text-right tabular-nums"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      value={v.stock ?? ""}
                      onChange={(e) => update(i, { stock: e.target.value === "" ? null : e.target.value })}
                      placeholder="auto"
                      className="w-full border border-gray-300 px-2 py-1 text-right tabular-nums"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={v.sku_suffix || ""}
                      onChange={(e) => update(i, { sku_suffix: e.target.value })}
                      placeholder="-7K"
                      className="w-full border border-gray-300 px-2 py-1 font-mono text-xs"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => remove(i)} className="p-1 text-red-600 hover:bg-red-50" data-testid={`prod-variant-remove-${i}`}>
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={add} className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#C5A059] hover:underline" data-testid="prod-variant-add">
        <Plus size={14} /> Añadir variante
      </button>
    </fieldset>
  );
}
