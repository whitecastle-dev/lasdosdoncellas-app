import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, ImagePlus, Tag as TagIcon, ArrowUp, ArrowDown } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import TableFilter, { filterRows } from "@/components/admin/TableFilter";
import useSort, { SortHeader } from "@/components/admin/useSort";

const EMPTY = { name: "", slug: "", description: "", image_url: "", position: null, is_active: true };

const slugify = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function CategoriesAdmin() {
  const [cats, setCats] = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    try {
      const [c, p] = await Promise.all([
        api.get("/categories"),
        api.get("/products", { params: { is_active: undefined } }),
      ]);
      setCats(c.data || []);
      const counts = {};
      for (const pr of p.data || []) {
        if (!pr.category_id) continue;
        counts[pr.category_id] = (counts[pr.category_id] || 0) + 1;
      }
      setProductCounts(counts);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterRows(cats, q), [cats, q]);
  const { sorted, sortBy, sort } = useSort(filtered);

  const save = async () => {
    if (!editing.name || !editing.slug) {
      toast.error("Nombre y slug son obligatorios");
      return;
    }
    try {
      if (editing.id) {
        const { image_url, ...rest } = editing;
        await api.patch(`/categories/${editing.id}`, rest);
        toast.success("Categoría actualizada");
      } else {
        await api.post("/categories", editing);
        toast.success("Categoría creada");
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const onDelete = async (c) => {
    const n = productCounts[c.id] || 0;
    const extra = n > 0 ? `\n\nLos ${n} producto(s) de esta categoría quedarán SIN categoría asignada.` : "";
    if (!window.confirm(`¿Eliminar categoría "${c.name}"?${extra}`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success("Categoría eliminada");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const movePosition = async (c, delta) => {
    const newPos = Math.max(1, (c.position || 1) + delta);
    try {
      await api.patch(`/categories/${c.id}`, { position: newPos });
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const openCreate = () => setEditing({ ...EMPTY, position: (cats.length || 0) + 1 });
  const openEdit = (c) => setEditing({ ...EMPTY, ...c });

  const uploadImage = async (file) => {
    if (!editing?.id) {
      // Si la categoría aún no se ha guardado, guardamos primero
      toast.error("Guarda la categoría primero (Nombre + Slug) y vuelve a subir la imagen.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post(`/categories/${editing.id}/image`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEditing((e) => ({ ...e, image_url: data.url }));
      toast.success("Imagen subida");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto" data-testid="categories-admin">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow text-gray-500">Estructura del catálogo</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1">Categorías</h1>
          <p className="text-sm text-gray-500 mt-2">
            Se muestran en la barra del storefront y en el bloque "Explora por categoría" del inicio.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <TableFilter value={q} onChange={setQ} placeholder="Buscar por cualquier campo…" testid="categories-filter" />
          <button onClick={openCreate} className="ldd-btn-gold" data-testid="categories-new">
            <Plus size={16} /> Nueva categoría
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500">
            <tr>
              <th className="p-4 text-left">Imagen</th>
              <SortHeader sortBy={sortBy} sort={sort} field="position" className="p-4 text-left">Orden</SortHeader>
              <SortHeader sortBy={sortBy} sort={sort} field="name" className="p-4 text-left">Nombre</SortHeader>
              <SortHeader sortBy={sortBy} sort={sort} field="slug" className="p-4 text-left">Slug</SortHeader>
              <th className="p-4 text-left">Productos</th>
              <SortHeader sortBy={sortBy} sort={sort} field="is_active" className="p-4 text-left">Estado</SortHeader>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50" data-testid={`category-row-${c.slug}`}>
                <td className="p-3">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="w-16 h-16 object-cover border border-gray-200" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                      <TagIcon size={20} />
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-600">{c.position ?? "—"}</span>
                    <button onClick={() => movePosition(c, -1)} className="p-1 hover:bg-gray-200 text-gray-500" title="Subir" data-testid={`category-up-${c.slug}`}>
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => movePosition(c, 1)} className="p-1 hover:bg-gray-200 text-gray-500" title="Bajar" data-testid={`category-down-${c.slug}`}>
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </td>
                <td className="p-4 font-serif text-base">{c.name}</td>
                <td className="p-4 font-mono text-xs text-gray-600">{c.slug}</td>
                <td className="p-4 text-gray-600">{productCounts[c.id] || 0}</td>
                <td className="p-4">
                  {c.is_active !== false ? (
                    <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded">Activa</span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">Oculta</span>
                  )}
                </td>
                <td className="p-3 text-right space-x-1">
                  <button onClick={() => openEdit(c)} className="p-2 hover:bg-gray-100 text-gray-700" title="Editar" data-testid={`category-edit-${c.slug}`}>
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => onDelete(c)} className="p-2 hover:bg-red-50 text-red-700" title="Eliminar" data-testid={`category-delete-${c.slug}`}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-gray-400">No hay categorías. Crea la primera con el botón "Nueva categoría".</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer / Modal de edición */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="category-editor">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-serif text-xl">{editing.id ? "Editar categoría" : "Nueva categoría"}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-900"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Nombre" required>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      // Auto-slug si no se ha tocado o estaba sincronizado con el nombre anterior
                      setEditing((c) => {
                        const prevSlug = slugify(c.name);
                        const slugWasAuto = !c.slug || c.slug === prevSlug;
                        return { ...c, name, slug: slugWasAuto ? slugify(name) : c.slug };
                      });
                    }}
                    className="w-full border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#C5A059]"
                    data-testid="category-edit-name"
                  />
                </Field>
                <Field label="Slug" required hint="Identificador en URL (sin espacios)">
                  <input
                    type="text"
                    value={editing.slug}
                    onChange={(e) => setEditing((c) => ({ ...c, slug: slugify(e.target.value) }))}
                    className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#C5A059]"
                    data-testid="category-edit-slug"
                  />
                </Field>
              </div>

              <Field label="Descripción">
                <textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing((c) => ({ ...c, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#C5A059]"
                  data-testid="category-edit-description"
                  placeholder="Aparece bajo el título de la categoría en el storefront"
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Posición" hint="Menor = aparece primero">
                  <input
                    type="number"
                    value={editing.position ?? ""}
                    onChange={(e) => setEditing((c) => ({ ...c, position: e.target.value === "" ? null : Number(e.target.value) }))}
                    className="w-full border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#C5A059]"
                    data-testid="category-edit-position"
                  />
                </Field>
                <Field label="Estado">
                  <label className="flex items-center gap-2 mt-2 cursor-pointer" data-testid="category-edit-active">
                    <input
                      type="checkbox"
                      checked={editing.is_active !== false}
                      onChange={(e) => setEditing((c) => ({ ...c, is_active: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Activa (visible en el storefront)</span>
                  </label>
                </Field>
              </div>

              <Field label="Imagen de la categoría" hint="Se muestra en 'Explora por categoría' del inicio. Recomendado 1200×1600 (vertical).">
                <div className="flex items-center gap-4">
                  {editing.image_url ? (
                    <img src={editing.image_url} alt="" className="w-24 h-32 object-cover border border-gray-200" />
                  ) : (
                    <div className="w-24 h-32 bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                      <ImagePlus size={20} />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
                      data-testid="category-image-input"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || !editing.id}
                      className="px-3 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-sm flex items-center gap-2"
                      data-testid="category-image-upload"
                    >
                      <ImagePlus size={14} />
                      {uploading ? "Subiendo…" : (editing.image_url ? "Reemplazar imagen" : "Subir imagen")}
                    </button>
                    {!editing.id && (
                      <p className="text-xs text-gray-500">Guarda la categoría primero para poder subir la imagen.</p>
                    )}
                    {editing.image_url && (
                      <button
                        type="button"
                        onClick={() => setEditing((c) => ({ ...c, image_url: "" }))}
                        className="text-xs text-red-600 hover:underline"
                      >Quitar imagen</button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm border border-gray-300 hover:bg-gray-50" data-testid="category-cancel">Cancelar</button>
              <button onClick={save} className="ldd-btn-gold" data-testid="category-save">{editing.id ? "Guardar cambios" : "Crear categoría"}</button>
            </div>
          </div>
        </div>
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
