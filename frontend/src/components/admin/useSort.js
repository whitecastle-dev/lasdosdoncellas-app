import { useState, useMemo } from "react";

/**
 * Hook simple para ordenación clickable de tablas.
 *
 *   const { sorted, sortBy, sort } = useSort(rows, "name");
 *   <th onClick={() => sortBy("name")}>Nombre {sort.key === "name" && (sort.dir === "asc" ? "↑" : "↓")}</th>
 *
 * Soporta strings, números, fechas (string ISO) y campos anidados con dot:
 *   sortBy("category.name")
 */
export default function useSort(rows, defaultKey = null, defaultDir = "asc") {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });

  const sortBy = (key) => {
    setSort((s) => {
      if (s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return { key: null, dir: "asc" }; // toggle off
    });
  };

  const get = (obj, path) => {
    if (!path) return undefined;
    return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  };

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    const copy = [...(rows || [])];
    copy.sort((a, b) => {
      const va = get(a, sort.key);
      const vb = get(b, sort.key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      // Números
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      // Booleans (false < true)
      if (typeof va === "boolean" && typeof vb === "boolean") return ((va ? 1 : 0) - (vb ? 1 : 0)) * factor;
      // Strings comparados sin acentos
      const sa = String(va);
      const sb = String(vb);
      return sa.localeCompare(sb, "es", { sensitivity: "base", numeric: true }) * factor;
    });
    return copy;
  }, [rows, sort]);

  return { sorted, sortBy, sort };
}

/** Componente de header de tabla clickable con flecha sort. */
export function SortHeader({ label, sortKey, sort, sortBy, className = "", testid }) {
  const active = sort?.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      onClick={() => sortBy(sortKey)}
      className={`cursor-pointer select-none hover:bg-gray-100 ${className}`}
      data-testid={testid || `sort-${sortKey}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[10px] mono ${active ? "text-[#C5A059]" : "text-gray-300"}`}>{arrow || "↕"}</span>
      </span>
    </th>
  );
}
