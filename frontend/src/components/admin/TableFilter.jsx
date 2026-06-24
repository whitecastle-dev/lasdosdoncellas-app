import React from "react";
import { Search, X } from "lucide-react";

function deburr(s) {
  try { return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  catch { return String(s ?? "").toLowerCase(); }
}

function flatten(obj) {
  const out = [];
  const walk = (v) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === "object") { Object.values(v).forEach(walk); return; }
    out.push(String(v));
  };
  walk(obj);
  return out.join(" ");
}

export function filterRows(rows, query) {
  if (!query || !query.trim()) return rows;
  const q = deburr(query.trim());
  const parts = q.split(/\s+/);
  return rows.filter((r) => {
    const hay = deburr(flatten(r));
    return parts.every((p) => hay.includes(p));
  });
}

export default function TableFilter({ value, onChange, placeholder = "Buscar en la tabla…", testid }) {
  return (
    <div className="relative w-full sm:w-80" data-testid={testid || "table-filter"}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 focus:border-black outline-none bg-white"
      />
      {value && (
        <button type="button" onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black" aria-label="Limpiar filtro">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
