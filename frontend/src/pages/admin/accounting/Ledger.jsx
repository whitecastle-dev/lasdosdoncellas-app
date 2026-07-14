import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";

export default function Ledger() {
  const [accounts, setAccounts] = useState([]);
  const [code, setCode] = useState("572");
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState({ from: "", to: "" });

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/accounting/accounts");
        setAccounts(r.data);
      } catch (err) { toast.error(formatApiError(err)); }
    })();
  }, []);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const p = new URLSearchParams();
        if (filter.from) p.set("from", filter.from);
        if (filter.to) p.set("to", filter.to);
        const r = await api.get(`/accounting/ledger/${code}?${p.toString()}`);
        setData(r.data);
      } catch (err) { toast.error(formatApiError(err)); }
    })();
  }, [code, filter]);

  const totalD = data?.rows.reduce((s, r) => s + r.debit, 0) || 0;
  const totalH = data?.rows.reduce((s, r) => s + r.credit, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="label-eyebrow text-gray-500 mb-1">Cuenta</div>
          <select value={code} onChange={(e) => setCode(e.target.value)}
            className="border border-gray-200 px-2 py-1.5 text-sm bg-white min-w-[280px]" data-testid="lg-account">
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        <div>
          <div className="label-eyebrow text-gray-500 mb-1">Desde</div>
          <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            className="border border-gray-200 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <div className="label-eyebrow text-gray-500 mb-1">Hasta</div>
          <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            className="border border-gray-200 px-2 py-1.5 text-sm" />
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Stat label="Cuenta" value={<span className="mono">{data.account?.code}</span>} sub={data.account?.name} />
            <Stat label="Total debe" value={formatMoney(totalD)} />
            <Stat label="Total haber" value={formatMoney(totalH)} />
            <Stat label="Saldo" value={formatMoney(data.saldo_final)} highlight
                  color={data.saldo_final >= 0 ? "text-green-700" : "text-red-700"} />
          </div>
          <div className="cms-card overflow-hidden">
            <table className="cms-table w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th>Concepto</th>
                  <th className="text-right">Debe</th>
                  <th className="text-right">Haber</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-400">Sin movimientos.</td></tr>
                )}
                {data.rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100" data-testid={`lg-row-${i}`}>
                    <td className="px-4 py-2 text-xs">{r.fecha}</td>
                    <td className="text-sm">{r.concepto}<div className="text-xs text-gray-400 mono">{r.source_ref}</div></td>
                    <td className="text-right font-serif">{r.debit > 0 ? formatMoney(r.debit) : "—"}</td>
                    <td className="text-right font-serif">{r.credit > 0 ? formatMoney(r.credit) : "—"}</td>
                    <td className="text-right font-serif font-medium">{formatMoney(r.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, highlight, color }) {
  return (
    <div className={`p-4 border ${highlight ? "border-black" : "border-gray-200"}`}>
      <div className="label-eyebrow text-gray-500">{label}</div>
      <div className={`font-serif text-2xl ${color || ""}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
