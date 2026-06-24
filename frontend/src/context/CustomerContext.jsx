import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const AUTH_API = `${BACKEND_URL}/api/auth`;

// IMPORTANTE: usamos withCredentials:false en el contexto del CLIENTE para
// que NO se envíen las cookies del admin (access_token) que viven en el mismo
// dominio. Si las enviásemos, el backend respondería con los datos del admin
// logueado en CMS y "Super" aparecería arriba a la derecha del storefront.
// El token del cliente se manda exclusivamente vía Authorization Bearer.
export const customerApi = axios.create({
  baseURL: `${BACKEND_URL}/api/customer`,
  withCredentials: false,
});

const authApi = axios.create({
  baseURL: AUTH_API,
  withCredentials: false,
});

const attachToken = (config) => {
  const t = localStorage.getItem("ldd_customer_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
};
customerApi.interceptors.request.use(attachToken);
authApi.interceptors.request.use(attachToken);

const CustomerCtx = createContext({ customer: null, loading: true });

// Sólo aceptamos como "cliente" a usuarios cuyo role sea customer
// (evitamos que un admin/superadmin aparezca logueado en el storefront).
const isCustomerUser = (u) => {
  if (!u) return false;
  if (u.is_superadmin) return false;
  const role = (u.role || "").toLowerCase();
  return role === "" || role === "customer";
};

export function CustomerProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = async (payload) => {
    const { data } = await authApi.post("/register", payload);
    return data;
  };

  const login = async (email, password) => {
    const { data } = await authApi.post("/login", { email, password });
    if (data.access_token) {
      localStorage.setItem("ldd_customer_token", data.access_token);
    }
    if (data.user && isCustomerUser(data.user)) {
      setCustomer(data.user);
    }
    return data.user;
  };

  const logout = async () => {
    try { await authApi.post("/logout"); } catch { /* ignore */ }
    localStorage.removeItem("ldd_customer_token");
    setCustomer(null);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      // Si no hay token de cliente, no hay nada que refrescar.
      const t = localStorage.getItem("ldd_customer_token");
      if (!t) {
        setCustomer(null);
        return null;
      }
      const { data } = await authApi.get("/me");
      if (isCustomerUser(data)) {
        setCustomer(data);
        return data;
      }
      // El token guardado pertenece a un admin → lo limpiamos para evitar loops
      localStorage.removeItem("ldd_customer_token");
      setCustomer(null);
      return null;
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
