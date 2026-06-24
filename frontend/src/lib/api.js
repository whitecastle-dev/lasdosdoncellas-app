import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Interceptor: prioriza el token CMS si existe; si no, usa el token de cliente
// (esto soluciona el "No autenticado" al postear reseñas como cliente WEB
// porque antes solo se enviaba ldd_token).
api.interceptors.request.use((config) => {
  const adminT = localStorage.getItem("ldd_token");
  const customerT = localStorage.getItem("ldd_customer_token");
  const t = adminT || customerT;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const fileUrl = (path) => `${API}/files/${path}`;

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (!d) return err?.message || "Algo ha fallado";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e.msg || JSON.stringify(e)).join(" ");
  return String(d);
}

export function formatMoney(v) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v || 0);
}
