import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const AUTH_API = `${BACKEND_URL}/api/auth`; 

export const customerApi = axios.create({
  baseURL: `${BACKEND_URL}/api/customer`,
  withCredentials: true,
});

// authApi: registro, login, /me, reset password (sistema unificado)
const authApi = axios.create({
  baseURL: AUTH_API,
  withCredentials: true,
});

// Interceptor: añade el Bearer token a ambas instancias (fallback si las
// cookies cross-site son bloqueadas por el navegador)
const attachToken = (config) => {
  const t = localStorage.getItem("ldd_customer_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
};
customerApi.interceptors.request.use(attachToken);
authApi.interceptors.request.use(attachToken);

const CustomerCtx = createContext({ customer: null, loading: true });

export function CustomerProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh(); // Usamos la función refresh para inicializar el estado
  }, []);

  const register = async (payload) => {
    const { data } = await authApi.post("/register", payload);
    return data;
  };

  const login = async (email, password) => {
    const { data } = await authApi.post("/login", { email, password });
    // El backend ahora devuelve access_token + user en el body.
    // Guardamos el token como fallback (cookies httpOnly se aplican en paralelo).
    if (data.access_token) {
      localStorage.setItem("ldd_customer_token", data.access_token);
    }
    // Pinta el menú inmediatamente con el user del body (sin esperar al /me)
    if (data.user) setCustomer(data.user);
    // Después sincroniza con /me para confirmar y traer datos completos
    await refresh();
    return data.user;
  };

  const logout = async () => {
    try { await authApi.post("/logout"); } catch {}
    localStorage.removeItem("ldd_customer_token");
    setCustomer(null);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      // Usamos authApi (/api/auth/me) — endpoint unificado para clientes y admin.
      // El interceptor añade el Bearer automáticamente; si no hay token y las
      // cookies cross-site sí llegan, sigue funcionando.
      const { data } = await authApi.get("/me");
      setCustomer(data);
      return data;
    } catch {
      setCustomer(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomerCtx.Provider value={{ customer, loading, register, login, logout, refresh, setCustomer }}>
      {children}
    </CustomerCtx.Provider>
  );
}

export const useCustomer = () => useContext(CustomerCtx);