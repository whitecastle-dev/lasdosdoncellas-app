import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const AUTH_API = `${BACKEND_URL}/api/auth`; 

export const customerApi = axios.create({
  baseURL: `${BACKEND_URL}/api/customer`,
  withCredentials: true,
});

// Creamos una instancia específica para Auth que no requiere token inicial
const authApi = axios.create({
  baseURL: AUTH_API,
  withCredentials: true,
});

customerApi.interceptors.request.use((config) => {
  const t = localStorage.getItem("ldd_customer_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

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
    if (data.access_token) {
      localStorage.setItem("ldd_customer_token", data.access_token);
    }
    // No dependemos solo del user que devuelve el login, 
    // forzamos un refresh para asegurar que el estado esté sincronizado
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
      const t = localStorage.getItem("ldd_customer_token");
      if (!t) { setCustomer(null); return null; }
      const { data } = await customerApi.get("/me");
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