import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/auth/forgot-password`, { email });
      toast.success("Si el email existe, recibirás un enlace de recuperación.");
    } catch (err) {
      toast.error("Error al enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => {}} />
      <div className="max-w-md mx-auto px-6 py-20">
        <h1 className="font-serif text-4xl tracking-tighter" style={{ color: "#FAF8F5" }}>Recuperar cuenta</h1>
        <p className="mt-3 text-sm" style={{ color: "rgba(250,248,245,0.6)" }}>
          Introduce tu email y te enviaremos un enlace para cambiar tu contraseña.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input 
            type="email" 
            placeholder="Email *" 
            required 
            className="w-full bg-transparent border border-[rgba(250,248,245,0.2)] px-4 py-3 text-sm text-white focus:border-[#C5A059] outline-none"
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={loading} className="ldd-btn-gold w-full justify-center">
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          <Link to="/cuenta/login" className="gold hover:underline">Volver a iniciar sesión</Link>
        </div>
      </div>
      <StoreFooter />
    </div>
  );
}