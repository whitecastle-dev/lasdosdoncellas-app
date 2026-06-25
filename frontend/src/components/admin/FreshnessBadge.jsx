import React, { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Badge en el footer del sidebar del CMS. Muestra "Sincronizado hace X" donde
 * X es el tiempo transcurrido desde el último cambio en productos o categorías.
 * Sirve para confirmar visualmente que la BD ya tiene los datos esperados
 * tras un deploy.
 */
export default function FreshnessBadge() {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      try {
        const { data } = await api.get("/admin/freshness");
        if (active) setData(data);
      } catch { /* silenciar — no es crítico */ }
    };
    fetchIt();
    // Refresca cada 60s + un ticker cada 30s para que el "hace X" se actualice
    const id = setInterval(fetchIt, 60000);
    const tickerId = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { active = false; clearInterval(id); clearInterval(tickerId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data?.latest_change_at) return null;
  const ago = formatAgo(data.latest_change_at, data.now);

  return (
    <div
      className="px-3 py-2 text-[11px] tracking-wider flex items-center gap-2"
      data-testid="freshness-badge"
      style={{ color: "rgba(250,248,245,0.55)" }}
      title={`Último cambio: ${new Date(data.latest_change_at).toLocaleString("es-ES")} · ticker=${tick}`}
    >
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Database size={12} className="opacity-70" />
      <span className="uppercase">Sincronizado · {ago}</span>
    </div>
  );
}

function formatAgo(iso, nowIso) {
  try {
    const then = new Date(iso).getTime();
    const now = nowIso ? new Date(nowIso).getTime() : Date.now();
    const sec = Math.max(0, Math.floor((now - then) / 1000));
    if (sec < 60) return "hace segundos";
    const min = Math.floor(sec / 60);
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `hace ${d} día${d === 1 ? "" : "s"}`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `hace ${mo} mes${mo === 1 ? "" : "es"}`;
    return `hace ${Math.floor(mo / 12)} año${Math.floor(mo / 12) === 1 ? "" : "s"}`;
  } catch {
    return "—";
  }
}
