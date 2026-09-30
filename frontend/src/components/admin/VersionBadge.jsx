import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Muestra el commit + hora de arranque del backend en el pie del sidebar
 * del CMS. Permite verificar de un vistazo qué build se está sirviendo y
 * detectar bundles de front cacheados.
 */
export default function VersionBadge() {
  const [ver, setVer] = useState(null);
  useEffect(() => {
    api.get("/version").then((r) => setVer(r.data)).catch(() => {});
  }, []);
  if (!ver) return null;
  const startedAt = ver.started_at
    ? new Date(ver.started_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div
      className="px-3 py-1 text-[10px] flex items-center justify-between gap-2"
      style={{ color: "rgba(250,248,245,0.35)" }}
      title={`Commit ${ver.commit} · backend arrancado ${ver.started_at}`}
      data-testid="admin-version-badge"
    >
      <span className="font-mono">build {ver.commit}</span>
      <span>{startedAt}</span>
    </div>
  );
}
