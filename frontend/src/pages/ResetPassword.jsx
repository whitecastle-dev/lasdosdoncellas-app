import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      // Enviamos el token y la nueva contraseña dentro del cuerpo (JSON)
      await axios.post(`${BACKEND_URL}/api/auth/reset-password`, {
        token: token,
        new_password: password
      });
      
      toast.success("Contraseña actualizada con éxito.");
      nav("/cuenta/login");
    } catch (err) {
      // Mostramos el detalle del error proporcionado por el backend
      toast.error(err.response?.data?.detail || "El enlace ha expirado o es inválido.");
    }
  };

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => {}} />
      <div className="max-w-md mx-auto px-6 py-20">
        <h1 className="font-serif text-4xl tracking-tighter" style={{ color: "#FAF8F5" }}>Nueva contraseña</h1>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input 
            type="password" 
            placeholder="Nueva contraseña *" 
            required 
            className="w-full bg-transparent border border-[rgba(250,248,245,0.2)] px-4 py-3 text-sm text-white focus:border-[#C5A059] outline-none"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="ldd-btn-gold w-full justify-center">Cambiar contraseña</button>
        </form>
      </div>
      <StoreFooter />
    </div>
  );
}