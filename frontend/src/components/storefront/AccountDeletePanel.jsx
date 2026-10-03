import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Undo2 } from "lucide-react";
import { customerApi } from "@/context/CustomerContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const inputCls = "w-full bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-3 py-2 text-sm";

export default function AccountDeletePanel({ customer, refresh, logout }) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const dueDate = customer.deletion_due_at
    ? new Date(customer.deletion_due_at).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const cancel = async () => {
    setBusy(true);
    try {
      await customerApi.post("/account/cancel-deletion");
      await refresh();
      toast.success("Baja cancelada. Tu cuenta sigue activa.");
    } catch (err) { toast.error(formatApiError(err)); } finally { setBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (confirmText.trim().toUpperCase() !== "BAJA") { toast.error('Escribe "BAJA" para confirmar'); return; }
    setBusy(true);
    try {
      const { data } = await customerApi.post("/account/delete", { password, reason });
      toast.success(`Baja programada. Tu cuenta se eliminará el ${new Date(data.deletion_due_at).toLocaleDateString("es-ES")}.`, { duration: 8000 });
      await logout();
      nav("/");
    } catch (err) { toast.error(formatApiError(err)); } finally { setBusy(false); }
  };

  if (customer.pending_deletion) {
    return (
      <div className="border border-amber-500/40 bg-amber-500/10 p-8" data-testid="account-pending-deletion">
        <div className="label-eyebrow gold mb-3">Baja programada</div>
        <h2 className="font-serif text-2xl mb-3" style={{ color: "#FAF8F5" }}>Tu cuenta se eliminará el {dueDate}</h2>
        <p className="text-sm mb-6" style={{ color: "rgba(250,248,245,0.75)" }}>
          Hasta esa fecha puedes cancelar la baja con un clic. Si no haces nada, borraremos tu perfil,
          direcciones y formas de pago. Tus pedidos se conservarán anonimizados por obligación fiscal.
        </p>
        <button onClick={cancel} disabled={busy} className="ldd-btn-gold" data-testid="account-cancel-deletion">
          <Undo2 size={14} /> Cancelar la baja
        </button>
      </div>
    );
  }

  return (
    <div className="border border-[rgba(140,33,30,0.5)] p-8" data-testid="account-delete-panel">
      <div className="flex items-center gap-2 mb-3" style={{ color: "#E07A5F" }}>
        <AlertTriangle size={16} />
        <span className="label-eyebrow" style={{ color: "#E07A5F" }}>Zona sensible</span>
      </div>
      <h2 className="font-serif text-2xl mb-3" style={{ color: "#FAF8F5" }}>Darse de baja</h2>
      <p className="text-sm mb-6 max-w-xl" style={{ color: "rgba(250,248,245,0.75)" }}>
        Al solicitar la baja, tu cuenta queda <strong>desactivada durante 30 días</strong>. Si inicias sesión en ese
        plazo, la baja se cancela automáticamente. Pasados los 30 días eliminaremos tu perfil, direcciones y
        formas de pago de manera definitiva. Los pedidos realizados se conservan anonimizados por obligación fiscal.
      </p>
      <form onSubmit={submit} className="space-y-4 max-w-lg">
        <div>
          <label className="label-eyebrow gold block mb-2">Contraseña actual</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} data-testid="delete-password" />
        </div>
        <div>
          <label className="label-eyebrow gold block mb-2">Motivo (opcional)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputCls} data-testid="delete-reason" />
        </div>
        <div>
          <label className="label-eyebrow gold block mb-2">Escribe &ldquo;BAJA&rdquo; para confirmar</label>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} required className={inputCls} data-testid="delete-confirm-text" />
        </div>
        <button disabled={busy} className="px-6 py-3 text-xs uppercase tracking-[0.2em] border transition disabled:opacity-50"
          style={{ borderColor: "#8C211E", color: "#E07A5F" }} data-testid="delete-submit">
          {busy ? "Procesando…" : "Solicitar la baja"}
        </button>
      </form>
    </div>
  );
}
