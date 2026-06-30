import React, { useEffect, useMemo, useState, useRef } from "react";
import { Plus, Pencil, Trash2, Upload, X, Sparkles, ImagePlus } from "lucide-react";
import { api, formatApiError, formatMoney, fileUrl } from "@/lib/api";
import { toast } from "sonner";
import ExcelBar from "@/components/admin/ExcelBar";
import TableFilter, { filterRows } from "@/components/admin/TableFilter";
import useSort, { SortHeader } from "@/components/admin/useSort";
import VariantsEditor from "@/components/admin/VariantsEditor";
import CategoryAttributes from "@/components/admin/CategoryAttributes";

const EMPTY = {
  name: "", sku: "", description: "", long_description: "",
  price: 0, compare_at_price: 0, vat_rate: 10,
  category_id: "", provider_id: "", tags: "", stock: 0, low_stock_threshold: 5,
  weight_grams: 0, origin: "", curing_months: 0, breed: "Ibérico",
  feed: "Bellota", is_featured: false, is_active: true,
  variants: [], attributes: {},
};

const EMPTY_VARIANT = { label: "", price: 0, compare_at_price: 0, stock: null, sku_suffix: "", attributes: {} };

function imgSrc(img) {
  if (!img) return "";
  if (img.startsWith("/api/")) return `${process.env.REACT_APP_BACKEND_URL}${img}`;
  if (img.startsWith("http")) return img;
  return fileUrl(img);
}

export default function ProductsAdmin() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const bulkRef = useRef(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [dragOver, setDragOver] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, c, pr] = await Promise.all([
      api.get("/products"),
      api.get("/categories"),
      api.get("/providers").catch(() => ({ data: [] })),
    ]);
    setProducts(p.data);
    setCategories(c.data);
    setProviders(pr.data);
    setLoading(false);
    setSelected(new Set());
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterRows(products, q), [products, q]);
  const { sorted, sortBy, sort } = useSort(filtered);

  const toggle = (id) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected((s) => s.size === sorted.length ? new Set() : new Set(sorted.map((p) => p.id)));

  const deleteSelected = async () => {
    if (!selected.size) return;
    if (!window.confirm(`¿Eliminar ${selected.size} producto(s) seleccionado(s)?`)) return;
    try {
      const ids = [...selected];
      await Promise.all(ids.map((id) => api.delete(`/products/${id}`)));
      toast.success(`${ids.length} producto(s) eliminado(s)`);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const uploadBulkFiles = async (files) => {
    if (!files?.length) return;
    setBulkUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const { data } = await api.post("/products/images/bulk-import?enhance=true", fd, {
        headers: { "Content-Type": "multipart/form-data" }, timeout: 240000,
      });
      const msg = [
        `${data.imported} imagen${data.imported === 1 ? "" : "es"} subida${data.imported === 1 ? "" : "s"}`,
        data.skipped_no_sku_match?.length ? `${data.skipped_no_sku_match.length} sin SKU coincidente` : null,
        data.errors?.length ? `${data.errors.length} error${data.errors.length === 1 ? "" : "es"}` : null,
      ].filter(Boolean).join(" · ");
      toast.success(msg || "Importación completada");
      if (data.skipped_no_sku_match?.length) console.warn("Sin SKU coincidente:", data.skipped_no_sku_match);
      if (data.errors?.length) console.error("Errores:", data.errors);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBulkUploading(false); if (bulkRef.current) bulkRef.current.value = ""; }
  };

  const onBulkImages = (e) => uploadBulkFiles(Array.from(e.target.files || []));

  // Drag & drop de carpeta entera
  const onDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const items = e.dataTransfer?.items;
    if (!items) return;

    // Recolecta recursivamente todos los archivos de imagen
    const collectFromEntry = (entry) => new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file) => resolve(file && /^image\//.test(file.type) ? [file] : []));
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const all = [];
        const readAll = () => reader.readEntries(async (entries) => {
          if (!entries.length) {
            const lists = await Promise.all(all.map(collectFromEntry));
            resolve(lists.flat());
            return;
          }
          all.push(...entries);
          readAll();
        });
        readAll();
      } else { resolve([]); }
    });

    const promises = [];
    for (const it of items) {
      const entry = it.webkitGetAsEntry?.();
      if (entry) promises.push(collectFromEntry(entry));
      else { const f = it.getAsFile?.(); if (f && /^image\//.test(f.type)) promises.push(Promise.resolve([f])); }
    }
    const collected = (await Promise.all(promises)).flat();
    if (!collected.length) { toast.error("No se encontraron imágenes en lo soltado"); return; }
    toast.message(`Procesando ${collected.length} imagen${collected.length === 1 ? "" : "es"}…`);
    await uploadBulkFiles(collected);
  };

  const onDelete = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Producto eliminado");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="p-8 lg:p-10 max-w-[1700px] mx-auto">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow text-gray-500">Inventario</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1">Productos</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ExcelBar entity="products" onImported={load} />

          {/* Import masivo de imágenes por SKU */}
          <input ref={bulkRef} type="file" accept="image/*" multiple className="hidden"
                 onChange={onBulkImages} data-testid="products-bulk-images-input" />
          <button
            onClick={() => bulkRef.current?.click()}
            disabled={bulkUploading}
            title="Sube varias imágenes a la vez o arrastra una carpeta sobre la tabla. Cada archivo se nombra como SKU.jpg (o SKU-2.jpg, SKU-3.jpg, etc.)."
            className="px-3 py-2 border border-[#C5A059] text-[#7a5f24] hover:bg-[#C5A059] hover:text-black text-sm flex items-center gap-2 disabled:opacity-50"
            data-testid="products-bulk-images-btn"
          >
            <ImagePlus size={14} /> {bulkUploading ? "Procesando…" : "Importar imágenes (SKU)"}
          </button>

          <TableFilter value={q} onChange={setQ} placeholder="Buscar por cualquier campo…" testid="products-filter" />
          <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="products-new">
            <Plus size={14} /> Nuevo producto
          </button>
        </div>
      </div>

      <div className="cms-card overflow-hidden"
           onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
           onDragLeave={() => setDragOver(false)}
           onDrop={onDrop}
           style={dragOver ? { boxShadow: "0 0 0 3px #C5A059 inset" } : {}}
           data-testid="products-table-card">
        {dragOver && (
          <div className="p-4 text-center text-sm gold border-b border-[#C5A059]/40" data-testid="products-drop-hint">
            Suelta la carpeta o imágenes aquí — se subirán todas e identificadas por SKU
          </div>
        )}
        {selected.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-black text-white text-sm" data-testid="products-bulk-bar">
            <div>{selected.size} seleccionado{selected.size === 1 ? "" : "s"}</div>
            <div className="flex gap-3">
              <button onClick={() => setSelected(new Set())} className="text-xs label-eyebrow">Limpiar</button>
              <button onClick={deleteSelected} className="text-xs label-eyebrow text-red-300 hover:text-red-100" data-testid="products-bulk-delete">
                Eliminar selección
              </button>
            </div>
          </div>
        )}
        <table className="cms-table w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="py-3 px-4 w-8">
                <input type="checkbox" checked={selected.size > 0 && selected.size === sorted.length}
                       onChange={toggleAll} data-testid="products-select-all" />
              </th>
              <th>Img</th>
              <SortHeader label="SKU" sortKey="sku" sort={sort} sortBy={sortBy} />
              <SortHeader label="Nombre" sortKey="name" sort={sort} sortBy={sortBy} />
              <SortHeader label="Categoría" sortKey="category_id" sort={sort} sortBy={sortBy} />
              <SortHeader label="Proveedor" sortKey="provider_id" sort={sort} sortBy={sortBy} />
              <SortHeader label="Alta" sortKey="created_at" sort={sort} sortBy={sortBy} />
              <SortHeader label="Stock" sortKey="stock" sort={sort} sortBy={sortBy} className="text-right" />
              <SortHeader label="Precio" sortKey="price" sort={sort} sortBy={sortBy} className="text-right" />
              <SortHeader label="Estado" sortKey="is_active" sort={sort} sortBy={sortBy} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
            {!loading && sorted.length === 0 && <tr><td colSpan={11} className="py-12 text-center text-gray-400">{products.length === 0 ? <>No hay productos. <button onClick={() => setEditing("new")} className="underline">Crear el primero</button>.</> : "Ningún producto coincide con el filtro."}</td></tr>}
            {sorted.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`product-row-${p.id}`}>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} data-testid={`product-select-${p.id}`} />
                </td>
                <td className="px-4 py-2">
                  <div className="w-12 h-12 bg-gray-100 overflow-hidden">
                    {p.image_urls?.[0] && <img src={imgSrc(p.image_urls[0])} alt="" className="w-full h-full object-cover" />}
                  </div>
                </td>
                <td className="mono">{p.sku}</td>
                <td className="font-medium">{p.name}</td>
                <td className="text-gray-600">{categories.find((c) => c.id === p.category_id)?.name || "—"}</td>
                <td className="text-gray-600 text-xs">{providers.find((pr) => pr.id === p.provider_id)?.name || "—"}</td>
                <td className="text-xs text-gray-500 mono">{(p.created_at || "").slice(0, 10)}</td>
                <td className={`mono text-right ${p.stock <= (p.low_stock_threshold || 5) ? "text-red-600" : ""}`}>{p.stock}</td>
                <td className="mono text-right">{formatMoney(p.price)}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 ${p.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                    {p.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right pr-4">
                  <button onClick={() => setEditing(p)} className="p-2 hover:bg-gray-100" data-testid={`product-edit-${p.id}`}><Pencil size={14} /></button>
                  <button onClick={() => onDelete(p.id)} className="p-2 hover:bg-red-50 text-red-600" data-testid={`product-delete-${p.id}`}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductDrawer
          initial={editing === "new" ? EMPTY : { ...editing, tags: (editing.tags || []).join(", ") }}
          categories={categories}
          providers={providers}
          startedNew={editing === "new"}
          onClose={() => {
            setEditing(null);
            // Resync con servidor por si hubo cambios fuera de optimistic update
            load();
          }}
          onSaved={(savedProduct) => {
            // Actualización optimista: mete/actualiza el producto en el estado
            // local SIN esperar al GET /products. Lista refresca al instante.
            if (savedProduct?.id) {
              setProducts((prev) => {
                const idx = prev.findIndex((p) => p.id === savedProduct.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { ...next[idx], ...savedProduct };
                  return next;
                }
                return [savedProduct, ...prev];
              });
            }
            // No cerramos el drawer: el usuario puede seguir editando / subiendo imágenes.
            // Cuando termine, cierra con la X o el fondo gris.
          }}
        />
      )}
    </div>
  );
}

function ProductDrawer({ initial, startedNew, categories, providers, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [enhance, setEnhance] = useState(true);
  const [created, setCreated] = useState(!startedNew); // true once we have an id
  const [cheeses, setCheeses] = useState([]); // para el maridaje en vinos
  const fileRef = useRef();

  // Carga ligera de los quesos del catálogo (para el selector de maridaje)
  useEffect(() => {
    const cheeseCat = categories.find((c) => c.slug === "quesos");
    if (!cheeseCat) return;
    api.get("/products", { params: { category_id: cheeseCat.id, is_active: true } })
      .then(({ data }) => setCheeses((data || []).map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => {});
  }, [categories]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setNum = (k) => (e) => setForm({ ...form, [k]: e.target.value === "" ? 0 : Number(e.target.value) });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      vat_rate: Number(form.vat_rate),
      stock: Number(form.stock),
      low_stock_threshold: Number(form.low_stock_threshold),
      weight_grams: form.weight_grams ? Number(form.weight_grams) : null,
      curing_months: form.curing_months ? Number(form.curing_months) : null,
      tags: typeof form.tags === "string"
        ? form.tags.split(",").map((s) => s.trim()).filter(Boolean)
        : form.tags,
      images: form.images || [],
      provider_id: form.provider_id || null,
      category_id: form.category_id || null,
      // Variantes y atributos por categoría (Fase 2)
      variants: (form.variants || []).map((v) => ({
        label: v.label,
        price: Number(v.price) || 0,
        compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
        stock: v.stock === "" || v.stock === null || v.stock === undefined ? null : Number(v.stock),
        sku_suffix: v.sku_suffix || null,
        attributes: v.attributes || null,
      })).filter((v) => v.label && v.price > 0),
      attributes: form.attributes || {},
    };
    try {
      if (!created) {
        const r = await api.post("/products", payload);
        setForm({ ...r.data, tags: (r.data.tags || []).join(", ") });
        setCreated(true);
        toast.success("Producto creado. Ahora puedes subir imágenes.");
        onSaved?.(r.data);
      } else {
        const r = await api.patch(`/products/${form.id}`, payload);
        setForm({ ...r.data, tags: (r.data.tags || []).join(", ") });
        toast.success("Producto actualizado");
        onSaved?.(r.data);
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setSaving(false); }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!form.id) {
      toast.error("Guarda el producto primero para añadir imágenes");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("enhance", String(enhance));
      const { data } = await api.post(`/products/${form.id}/images`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      const newImages = [...(form.images || []), data.url];
      const newImageUrls = [...(form.image_urls || []), data.url];
      setForm((f) => ({ ...f, images: newImages, image_urls: newImageUrls }));
      // Propaga al padre para que la tabla muestre la nueva imagen sin recargar
      onSaved?.({ ...form, images: newImages, image_urls: newImageUrls });
      toast.success(data.ai_enhanced ? "Imagen mejorada con IA ✨" : "Imagen subida");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = async (path) => {
    try {
      await api.delete(`/products/${form.id}/images`, { params: { storage_path: path } });
      const newImages = (form.images || []).filter((p) => p !== path);
      const newImageUrls = (form.image_urls || []).filter((u) => u !== path && !u.endsWith(path));
      setForm((f) => ({ ...f, images: newImages, image_urls: newImageUrls }));
      onSaved?.({ ...form, images: newImages, image_urls: newImageUrls });
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="product-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <div className="label-eyebrow text-gray-500">{!created ? "Nuevo" : "Editando"}</div>
            <div className="font-serif text-2xl">{form.name || "Producto"}</div>
            {form.created_at && <div className="text-xs text-gray-500 mt-1">Alta: {String(form.created_at).slice(0, 10)}</div>}
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={save} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <I label="Nombre *" value={form.name} onChange={set("name")} required testid="prod-name" />
            <I label="SKU *" value={form.sku} onChange={set("sku")} required testid="prod-sku" />
          </div>
          <T label="Descripción corta" value={form.description} onChange={set("description")} testid="prod-desc" />
          <T label="Descripción detallada" value={form.long_description} onChange={set("long_description")} rows={4} testid="prod-long" />

          <div className="grid grid-cols-3 gap-4">
            <I label="Precio (IVA incl.) €" type="number" step="0.01" value={form.price} onChange={setNum("price")} testid="prod-price" />
            <I label="Precio comparación €" type="number" step="0.01" value={form.compare_at_price} onChange={setNum("compare_at_price")} testid="prod-compare" />
            <S label="IVA %" value={form.vat_rate} onChange={setNum("vat_rate")} options={[{ v: 4, l: "4%" }, { v: 10, l: "10%" }, { v: 21, l: "21%" }]} testid="prod-vat" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <I label="Stock" type="number" value={form.stock} onChange={setNum("stock")} testid="prod-stock" />
            <I label="Umbral stock bajo" type="number" value={form.low_stock_threshold} onChange={setNum("low_stock_threshold")} testid="prod-threshold" />
            <I label="Peso (g)" type="number" value={form.weight_grams} onChange={setNum("weight_grams")} testid="prod-weight" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <S label="Categoría" value={form.category_id || ""} onChange={set("category_id")} options={[{ v: "", l: "— Sin categoría —" }, ...categories.map((c) => ({ v: c.id, l: c.name }))]} testid="prod-cat" />
            <S label="Proveedor" value={form.provider_id || ""} onChange={set("provider_id")} options={[{ v: "", l: "— Sin proveedor —" }, ...providers.map((p) => ({ v: p.id, l: p.name }))]} testid="prod-provider" />
          </div>
          <I label="Tags (coma)" value={form.tags} onChange={set("tags")} placeholder="jamones, bellota, regalo" testid="prod-tags" />

          <div className="grid grid-cols-2 gap-4">
            <I label="Origen / D.O." value={form.origin} onChange={set("origin")} testid="prod-origin" />
            <I label="Curación (meses)" type="number" value={form.curing_months} onChange={setNum("curing_months")} testid="prod-curing" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <I label="Raza" value={form.breed} onChange={set("breed")} testid="prod-breed" />
            <I label="Alimentación" value={form.feed} onChange={set("feed")} testid="prod-feed" />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={set("is_active")} data-testid="prod-active" /> Activo</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_featured} onChange={set("is_featured")} data-testid="prod-featured" /> Destacado</label>
          </div>

          <CategoryAttributes
            form={form}
            setForm={setForm}
            categorySlug={categories.find((c) => c.id === form.category_id)?.slug}
            allCheeses={cheeses}
          />

          <VariantsEditor variants={form.variants || []} onChange={(variants) => setForm({ ...form, variants })} />

          <button type="submit" disabled={saving} className="px-5 py-2.5 bg-black text-[#C5A059] disabled:opacity-50" data-testid="prod-save">
            {saving ? "Guardando…" : (!created ? "Crear producto" : "Guardar cambios")}
          </button>

          {/* Image section */}
          <div className="border-t border-gray-200 pt-6 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="label-eyebrow text-gray-500">Imágenes</div>
                <div className="font-serif text-xl">Galería</div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} data-testid="prod-enhance-toggle" />
                <Sparkles size={12} className="text-amber-600" /> Mejorar con IA (Nano Banana)
              </label>
            </div>
            {!created && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 mb-3" data-testid="prod-image-need-save">
                Guarda el producto primero para añadir imágenes. Una vez creado, las imágenes pasarán por edición automática IA con fondo de madera/barrica y mejora de nitidez.
              </div>
            )}
            {created && (
              <>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {(form.images || []).map((p) => (
                    <div key={p} className="relative aspect-square bg-gray-100 group">
                      <img src={imgSrc(p)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeImage(p)} className="absolute top-1 right-1 bg-black/70 text-white p-1 opacity-0 group-hover:opacity-100" data-testid={`prod-img-remove-${p}`}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square border-2 border-dashed border-gray-300 hover:border-black flex flex-col items-center justify-center gap-2 cursor-pointer text-gray-500" data-testid="prod-img-upload-label">
                    <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" data-testid="prod-img-upload" />
                    {uploading ? <span className="text-xs">Procesando con IA…</span> : <><Upload size={18} /><span className="text-xs">Subir imagen</span></>}
                  </label>
                </div>
                <p className="text-xs text-gray-500">La IA pondrá fondo de madera/barrica y mejorará nitidez automáticamente.</p>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function I({ testid, ...rest }) {
  return (
    <div>
      <label className="label-eyebrow text-gray-500 block mb-1">{rest.label}</label>
      <input data-testid={testid} {...rest} className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
    </div>
  );
}
function T({ rows = 2, testid, ...rest }) {
  return (
    <div>
      <label className="label-eyebrow text-gray-500 block mb-1">{rest.label}</label>
      <textarea {...rest} rows={rows} data-testid={testid} className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
    </div>
  );
}
function S({ options, testid, ...rest }) {
  return (
    <div>
      <label className="label-eyebrow text-gray-500 block mb-1">{rest.label}</label>
      <select {...rest} data-testid={testid} className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none bg-white">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
