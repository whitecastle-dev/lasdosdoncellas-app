import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Shield, Users as UsersIcon } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ExcelBar from "@/components/admin/ExcelBar";
import TableFilter, { filterRows } from "@/components/admin/TableFilter";

const PERMISSION_LABELS = {
  "dashboard.read": "Ver Dashboard",
  "products.read": "Ver Productos",
  "products.write": "Crear / Editar Productos",
  "products.delete": "Eliminar Productos",
  "orders.read": "Ver Pedidos",
  "orders.write": "Gestionar Pedidos",
  "orders.delete": "Eliminar Pedidos",
  "users.read": "Ver Usuarios CMS",
  "users.write": "Crear / Editar Usuarios CMS",
  "users.delete": "Eliminar Usuarios CMS",
  "customers.read": "Ver Usuarios WEB",
  "customers.write": "Editar Usuarios WEB",
  "customers.delete": "Eliminar Usuarios WEB",
  "settings.write": "Modificar Ajustes",
};

const EMPTY = { email: "", password: "", name: "", role: "manager", permissions: [], is_active: true };

export default function UsersAdmin() {
  const [tab, setTab] = useState("cms");
  const [users, setUsers] = useState([]);
  const [webUsers, setWebUsers] = useState([]);
  const [perms, setPerms] = useState([]);
  const [editing, setEditing] = useState(null);          // CMS user editing
  const [editingWeb, setEditingWeb] = useState(null);    // Web user editing
  const [qCms, setQCms] = useState("");
  const [qWeb, setQWeb] = useState("");
  const { user: me } = useAuth();

  const filteredCms = useMemo(() => filterRows(users, qCms), [users, qCms]);
  const filteredWeb = useMemo(() => filterRows(webUsers, qWeb), [webUsers, qWeb]);

  const load = async () => {
    const [u, p, w] = await Promise.all([
      api.get("/users"),
      api.get("/users/permissions"),
      api.get("/users/web").catch(() => ({ data: [] })),
    ]);
    setUsers(u.data);
    setPerms(p.data.permissions);
    setWebUsers(w.data);
  };
  useEffect(() => { load(); }, []);

  const onDelete = async (u) => {
    if (u.is_superadmin) return toast.error("No se puede eliminar al superadmin");
    if (!window.confirm(`¿Eliminar usuario ${u.email}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Usuario eliminado");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const onDeleteWeb = async (u) => {
    if (!window.confirm(`¿Eliminar al cliente ${u.email}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/users/web/${u.id}`);
      toast.success("Cliente eliminado");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="label-eyebrow text-gray-500">Acceso</div>
          <h1 className="font-serif text-4xl tracking-tight mt-1">Usuarios</h1>
        </div>
        {tab === "cms" && (
          <div className="flex items-center gap-3">
            <ExcelBar entity="users" onImported={load} />
            <button onClick={() => setEditing("new")} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2" data-testid="users-new">
              <Plus size={14} /> Nuevo usuario CMS
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button onClick={() => setTab("cms")} data-testid="users-tab-cms" className={`px-5 py-2 text-sm uppercase tracking-widest transition ${tab === "cms" ? "border-b-2 border-black text-black -mb-px" : "text-gray-500 hover:text-black"}`}>
          <Shield className="inline mr-2" size={14} /> Usuarios CMS ({users.length})
        </button>
        <button onClick={() => setTab("web")} data-testid="users-tab-web" className={`px-5 py-2 text-sm uppercase tracking-widest transition ${tab === "web" ? "border-b-2 border-black text-black -mb-px" : "text-gray-500 hover:text-black"}`}>
          <UsersIcon className="inline mr-2" size={14} /> Usuarios WEB ({webUsers.length})
        </button>
      </div>

      {tab === "cms" && (
        <>
          <div className="mb-4"><TableFilter value={qCms} onChange={setQCms} placeholder="Buscar usuario CMS…" testid="users-cms-filter" /></div>
          <div className="cms-card overflow-hidden">
            <table className="cms-table w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="py-3 px-4">Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Permisos</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredCms.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Ningún usuario coincide.</td></tr>}
                {filteredCms.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100" data-testid={`user-row-${u.id}`}>
                    <td className="px-4 py-3 flex items-center gap-2">
                      {u.is_superadmin && <Shield size={14} className="text-amber-600" />}
                      <span>{u.first_name ? `${u.first_name} ${u.last_name || ""}`.trim() : (u.name || u.email)}</span>
                    </td>
                    <td className="mono">{u.email}</td>
                    <td>{u.role}</td>
                    <td className="text-xs text-gray-600">{u.is_superadmin ? "Todos" : (u.permissions || []).length + " permisos"}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 ${u.is_active ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="text-right pr-4">
                      <button onClick={() => setEditing(u)} className="p-2 hover:bg-gray-100" data-testid={`user-edit-${u.id}`}><Pencil size={14} /></button>
                      {!u.is_superadmin && u.id !== me?.id && (
                        <button onClick={() => onDelete(u)} className="p-2 hover:bg-red-50 text-red-600" data-testid={`user-delete-${u.id}`}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "web" && (
        <>
          <div className="mb-4"><TableFilter value={qWeb} onChange={setQWeb} placeholder="Buscar por nombre, email, dirección, CP…" testid="users-web-filter" /></div>
          <div className="cms-card overflow-hidden">
            <table className="cms-table w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="py-3 px-4">Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Dirección</th>
                  <th>Localidad</th>
                  <th>CP</th>
                  <th>Verificado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredWeb.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-400">{webUsers.length === 0 ? "Aún no hay clientes registrados." : "Ningún cliente coincide con el filtro."}</td></tr>
                )}
                {filteredWeb.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100" data-testid={`web-user-row-${u.id}`}>
                    <td className="px-4 py-3">{`${u.first_name || ""} ${u.last_name || ""}`.trim() || u.name || "—"}</td>
                    <td className="mono text-xs">{u.email}</td>
                    <td className="text-gray-600">{u.phone || "—"}</td>
                    <td className="text-gray-600 text-xs max-w-[180px] truncate" title={u.address}>{u.address || "—"}</td>
                    <td className="text-gray-600 text-xs">{u.city || "—"}</td>
                    <td className="mono text-xs">{u.postal_code || "—"}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 ${u.is_verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {u.is_verified ? "Sí" : "Pendiente"}
                      </span>
                    </td>
                    <td className="text-right pr-4">
                      <button onClick={() => setEditingWeb(u)} className="p-2 hover:bg-gray-100" data-testid={`web-user-edit-${u.id}`}><Pencil size={14} /></button>
                      <button onClick={() => onDeleteWeb(u)} className="p-2 hover:bg-red-50 text-red-600" data-testid={`web-user-delete-${u.id}`}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <UserDrawer
          initial={editing === "new" ? EMPTY : { ...editing, password: "" }}
          isNew={editing === "new"}
          perms={perms}
          onClose={() => setEditing(null)}
          onSaved={() => { load(); setEditing(null); }}
        />
      )}

      {editingWeb && (
        <WebUserDrawer
          initial={{ ...editingWeb, password: "" }}
          onClose={() => setEditingWeb(null)}
          onSaved={() => { load(); setEditingWeb(null); }}
        />
      )}
    </div>
  );
}

function UserDrawer({ initial, isNew, perms, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const togglePerm = (p) => {
    const has = form.permissions?.includes(p);
    setForm({ ...form, permissions: has ? form.permissions.filter((x) => x !== p) : [...(form.permissions || []), p] });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post("/users", form);
        toast.success("Usuario creado");
      } else {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        delete payload.email;
        await api.patch(`/users/${form.id}`, payload);
        toast.success("Usuario actualizado");
      }
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="user-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <div className="label-eyebrow text-gray-500">{isNew ? "Nuevo" : "Editando"}</div>
            <div className="font-serif text-2xl">{form.name || "Usuario"}</div>
            {form.is_superadmin && <div className="text-xs text-amber-700 mt-1 flex items-center gap-1"><Shield size={12} /> Superadmin (protegido)</div>}
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-eyebrow text-gray-500 block mb-1">Nombre *</label>
              <input required value={form.name} onChange={set("name")} data-testid="user-name" className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
            </div>
            <div>
              <label className="label-eyebrow text-gray-500 block mb-1">Email {isNew && "*"}</label>
              <input required={isNew} disabled={!isNew} type="email" value={form.email} onChange={set("email")} data-testid="user-email"
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none disabled:bg-gray-50" />
            </div>
            <div>
              <label className="label-eyebrow text-gray-500 block mb-1">Contraseña {isNew ? "*" : "(opcional)"}</label>
              <input type="password" required={isNew} value={form.password} onChange={set("password")} data-testid="user-password"
                placeholder={isNew ? "Mín 8, mayús, minús y nº" : "Dejar vacío para no cambiar"}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
            </div>
            <div>
              <label className="label-eyebrow text-gray-500 block mb-1">Rol</label>
              <select disabled={form.is_superadmin} value={form.role} onChange={set("role")} data-testid="user-role"
                className="w-full border border-gray-200 px-3 py-2 text-sm bg-white disabled:bg-gray-50">
                <option value="manager">Manager</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm" data-testid="user-active-label">
            <input type="checkbox" checked={form.is_active} onChange={set("is_active")} disabled={form.is_superadmin} data-testid="user-active" /> Usuario activo
          </label>

          <div>
            <div className="label-eyebrow text-gray-500 mb-2">Permisos</div>
            <div className="grid grid-cols-2 gap-2">
              {perms.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm py-1 px-2 border border-gray-200 rounded-sm hover:bg-gray-50">
                  <input type="checkbox" disabled={form.is_superadmin}
                    checked={form.is_superadmin || (form.permissions || []).includes(p)}
                    onChange={() => togglePerm(p)}
                    data-testid={`user-perm-${p}`}
                  />
                  <span className="text-xs">{PERMISSION_LABELS[p] || p}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="px-5 py-2.5 bg-black text-[#C5A059] disabled:opacity-50" data-testid="user-save">
            {saving ? "Guardando…" : (isNew ? "Crear usuario" : "Guardar cambios")}
          </button>
        </form>
      </div>
    </div>
  );
}

function WebUserDrawer({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: initial.first_name || "",
    last_name: initial.last_name || "",
    phone: initial.phone || "",
    address: initial.address || "",
    city: initial.city || "",
    postal_code: initial.postal_code || "",
    country: initial.country || "España",
    is_active: initial.is_active !== false,
    is_verified: !!initial.is_verified,
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      await api.patch(`/users/web/${initial.id}`, payload);
      toast.success("Cliente actualizado");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="web-user-drawer">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <div className="label-eyebrow text-gray-500">Cliente WEB</div>
            <div className="font-serif text-2xl">{initial.email}</div>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-eyebrow text-gray-500 block mb-1">Nombre</label>
              <input value={form.first_name} onChange={set("first_name")} data-testid="web-user-first-name"
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
            </div>
            <div>
              <label className="label-eyebrow text-gray-500 block mb-1">Apellidos</label>
              <input value={form.last_name} onChange={set("last_name")} data-testid="web-user-last-name"
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
            </div>
            <div>
              <label className="label-eyebrow text-gray-500 block mb-1">Teléfono</label>
              <input value={form.phone} onChange={set("phone")} data-testid="web-user-phone"
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
            </div>
            <div>
              <label className="label-eyebrow text-gray-500 block mb-1">Nueva contraseña</label>
              <input type="password" value={form.password} onChange={set("password")} data-testid="web-user-password"
                placeholder="Vacío = no cambiar"
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <div className="label-eyebrow text-gray-500 mb-3">Dirección por defecto</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label-eyebrow text-gray-500 block mb-1">Dirección</label>
                <input value={form.address} onChange={set("address")} data-testid="web-user-address"
                  placeholder="Calle, número, piso…"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
              </div>
              <div>
                <label className="label-eyebrow text-gray-500 block mb-1">Localidad</label>
                <input value={form.city} onChange={set("city")} data-testid="web-user-city"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
              </div>
              <div>
                <label className="label-eyebrow text-gray-500 block mb-1">Código postal</label>
                <input value={form.postal_code} onChange={set("postal_code")} data-testid="web-user-postal"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
              </div>
              <div className="col-span-2">
                <label className="label-eyebrow text-gray-500 block mb-1">País</label>
                <input value={form.country} onChange={set("country")} data-testid="web-user-country"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={set("is_active")} data-testid="web-user-active" /> Cuenta activa
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_verified} onChange={set("is_verified")} data-testid="web-user-verified" /> Email verificado
            </label>
          </div>

          <button type="submit" disabled={saving} className="px-5 py-2.5 bg-black text-[#C5A059] disabled:opacity-50" data-testid="web-user-save">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}
