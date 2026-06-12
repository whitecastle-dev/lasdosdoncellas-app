import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const CUSTOMER_API = `${BACKEND_URL}/api/customer`;

export const customerApi = axios.create({
  baseURL: CUSTOMER_API,
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
    (async () => {
      try {
        const t = localStorage.getItem("ldd_customer_token");
        if (!t) { setLoading(false); return; }
        const { data } = await customerApi.get("/me");
        setCustomer(data);
      } catch {
        setCustomer(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const register = async (payload) => {
    const { data } = await customerApi.post("/register", payload);
    if (data.access_token) localStorage.setItem("ldd_customer_token", data.access_token);
    setCustomer(data.customer);
    return data.customer;
  };

  const login = async (email, password) => {
    const { data } = await customerApi.post("/login", { email, password });
    if (data.access_token) localStorage.setItem("ldd_customer_token", data.access_token);
    setCustomer(data.customer);
    return data.customer;
  };

  const logout = async () => {
    try { await customerApi.post("/logout"); } catch {}
    localStorage.removeItem("ldd_customer_token");
    setCustomer(null);
  };

  const refresh = async () => {
    try {
      const { data } = await customerApi.get("/me");
      setCustomer(data);
      return data;
    } catch { return null; }
  };

  return (
    <CustomerCtx.Provider value={{ customer, loading, register, login, logout, refresh, setCustomer }}>
      {children}
    </CustomerCtx.Provider>
  );
}

export const useCustomer = () => useContext(CustomerCtx);
