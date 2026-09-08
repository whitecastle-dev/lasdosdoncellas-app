// Hook: fetch data from the portal proxy and auto-refresh at a fixed interval
// so the CRM feels "live" without a manual refresh button.
import { useEffect, useRef, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";

/**
 * useLiveRows(table, params, options)
 *   - table: whitelisted Supabase table name
 *   - params: object of PostgREST-style query params (select/eq/order/limit)
 *   - options.interval: refresh interval in ms (default 20000)
 *   - options.pause: skip auto-refresh (still runs on mount + manual refetch)
 */
export function useLiveRows(table, params = {}, options = {}) {
  const { interval = 20000, pause = false, enabled = true } = options;
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchNow = useCallback(async () => {
    if (!enabled || !table) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      Object.entries(paramsRef.current || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
      });
      const { data } = await api.get(`/portal/rows/${table}?${q}`);
      setRows(data.rows || []);
      setError(null);
      setLastFetch(new Date());
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [table, enabled]);

  useEffect(() => {
    fetchNow();
  }, [fetchNow]);

  useEffect(() => {
    if (pause || !interval || !enabled) return undefined;
    const id = setInterval(fetchNow, interval);
    return () => clearInterval(id);
  }, [fetchNow, interval, pause, enabled]);

  return { rows, error, loading, lastFetch, refetch: fetchNow };
}

/** Same idea but for a single scalar/count endpoint. */
export function useLiveCount(table, params = {}, options = {}) {
  const { interval = 20000, pause = false } = options;
  const [count, setCount] = useState(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchNow = useCallback(async () => {
    if (!table) return;
    try {
      const q = new URLSearchParams();
      Object.entries(paramsRef.current || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
      });
      const { data } = await api.get(`/portal/rows/${table}/count?${q}`);
      setCount(data.count ?? 0);
    } catch {
      /* silent */
    }
  }, [table]);

  useEffect(() => { fetchNow(); }, [fetchNow]);
  useEffect(() => {
    if (pause || !interval) return undefined;
    const id = setInterval(fetchNow, interval);
    return () => clearInterval(id);
  }, [fetchNow, interval, pause]);

  return count;
}
