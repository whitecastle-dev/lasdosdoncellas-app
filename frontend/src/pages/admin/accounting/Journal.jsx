import React, { useEffect, useState } from "react";
import { api, formatApiError, formatMoney } from "@/lib/api";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";

const REF_LABEL = {
  pos_ticket: "TPV", issued_invoice: "F. emitida", supplier_invoice: "F. proveedor",
  salary: "Nómina", movement: "Movimiento",
};

export default function Journal() {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState({ from: "", to: "", account_code: "" });

  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (filter.from) p.set("from", filter.from);
      if (filter.to) p.set("to", filter.to);
      if (filter.account_code) p.set("account_code", filter.account_code);
      const [r, a] = await Promise.all([
        api.get(`/accounting/journal?${p.toString()}`),
        accounts.length ? Promise.resolve({ data: accounts }) : api.get("/accounting/accounts"),
      ]);
      setRows(r.data);
      if (a.data !== accounts) setAccounts(a.data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  useEffect(() => { load(); }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <div className="label-eyebrow text-gray-500 mb-1">Desde</div>
            <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })}
              className="border border-gray-200 px-2 py-1.5 text-sm" data-testid="jr-from" />
          </div>
          <div>
            <div className="label-eyebrow text-gray-500 mb-1">Hasta</div>
            <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })}
              className="border border-gray-200 px-2 py-1.5 text-sm" data-testid="jr-to" />
          </div>
          <div>
            <div className="label-eyebrow text-gray-500 mb-1">Cuenta</div>
            <select value={filter.account_code} onChange={(e) => setFilter({ ...filter, account_code: e.target.value })}
              className="border border-gray-200 px-2 py-1.5 text-sm bg-white" data-testid="jr-account">
              <option value="">Todas</option>
              {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="text-sm text-gray-500">{rows.length} asientos</div>
      </div>

      <div className="cms-card overflow-hidden">
        <table className="cms-table w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th>Concepto</th>
              <th>Origen</th>
              <th className="text-right">Debe</th>
              <th className="text-right">Haber</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-gray-400">Sin asientos.</td></tr>
            )}
            {rows.map((e) => (
              <React.Fragment key={e.id}>
                <tr className="border-t border-gray-100 bg-gray-50/50" data-testid={`jr-entry-${e.id}`}>
                  <td className="px-4 py-2 text-xs" rowSpan={e.lines.length + 1}>{e.fecha}</td>
                  <td className="text-sm" rowSpan={e.lines.length + 1}>
                    <div className="flex items-center gap-2">
                      <BookOpen size={12} className="text-[#C5A059]" />
                      <div>
                        <div>{e.concepto}</div>
                        <div className="text-xs text-gray-400 mono">{e.source_ref}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-xs" rowSpan={e.lines.length + 1}>
                    <span className="px-2 py-0.5 bg-gray-100">{REF_LABEL[e.reference_type] || e.reference_type || "—"}</span>
                  </td>
                  <td></td><td></td>
                </tr>
                {e.lines.map((l, i) => (
                  <tr key={i} className="text-xs">
                    <td className="text-right py-1 pr-3">
                      {l.debit > 0 && <><span className="mono text-gray-400 mr-2">{l.account_code}</span><span className="font-serif">{formatMoney(l.debit)}</span></>}
                    </td>
                    <td className="text-right py-1 pr-4">
                      {l.credit > 0 && <><span className="mono text-gray-400 mr-2">{l.account_code}</span><span className="font-serif">{formatMoney(l.credit)}</span></>}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
