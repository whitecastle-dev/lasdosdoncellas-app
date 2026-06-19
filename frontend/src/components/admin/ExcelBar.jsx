import React, { useRef } from "react";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

/**
 * ExcelBar — botones de Plantilla / Exportar / Importar para una entidad CMS.
 *
 * Props:
 *  - entity: "products" | "providers" | "categories" | "users" | "customers" | "orders"
 *  - ids: array de IDs seleccionados (opcional). Si no, exporta todo.
 *  - onImported(result): callback con {imported, updated, errors} para recargar.
 *  - exportLabel: nombre del archivo descarga (opcional)
 *  - hideImport: si true, oculta el botón de importar (p.ej. clientes)
 */
export default function ExcelBar({ entity, ids = [], onImported, hideImport = false }) {
  const fileRef = useRef();

  const downloadBlob = (data, filename) => {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const template = async () => {
    try {
      const r = await api.get(`/excel/${entity}/template`, { responseType: "blob" });
      downloadBlob(r.data, `plantilla_${entity}.xlsx`);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const exportData = async () => {
    try {
      const r = await api.post(`/excel/${entity}/export`, ids?.length ? { ids } : {}, { responseType: "blob" });
      downloadBlob(r.data, `${entity}_export.xlsx`);
      toast.success(`${ids?.length || "Todos los"} ${entity} exportados`);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const importData = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/excel/${entity}/import`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${data.imported} importados · ${data.updated} actualizados${data.errors?.length ? ` · ${data.errors.length} errores` : ""}`);
      if (data.errors?.length) console.warn("Import errors:", data.errors);
      onImported?.(data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={template} className="px-3 py-2 border border-gray-200 text-xs flex items-center gap-2 hover:bg-gray-50" data-testid={`excel-${entity}-template`} title="Descargar plantilla Excel">
        <FileSpreadsheet size={12} /> Plantilla
      </button>
      <button onClick={exportData} className="px-3 py-2 border border-gray-200 text-xs flex items-center gap-2 hover:bg-gray-50" data-testid={`excel-${entity}-export`}>
        <Download size={12} /> Exportar {ids?.length ? `(${ids.length})` : ""}
      </button>
      {!hideImport && (
        <label className="px-3 py-2 border border-gray-200 text-xs flex items-center gap-2 hover:bg-gray-50 cursor-pointer" data-testid={`excel-${entity}-import-label`}>
          <Upload size={12} /> Importar
          <input ref={fileRef} type="file" accept=".xlsx" onChange={importData} className="hidden" data-testid={`excel-${entity}-import-input`} />
        </label>
      )}
    </div>
  );
}
