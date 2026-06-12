import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function AdminLogin() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/admin" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bienvenido");
      navigate("/admin");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0A0A0A", color: "#FAF8F5" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="font-serif text-3xl">Las Dos Doncellas</div>
          <div className="font-script gold text-xl mt-1">Panel CMS</div>
        </div>
        <form onSubmit={onSubmit} className="space-y-5" data-testid="admin-login-form">
          <div>
            <label className="label-eyebrow gold block mb-2">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
              data-testid="admin-login-email"
              className="w-full bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-4 py-3 text-sm rounded-none" />
          </div>
          <div>
            <label className="label-eyebrow gold block mb-2">Contraseña</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
              data-testid="admin-login-password"
              className="w-full bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-4 py-3 text-sm rounded-none" />
          </div>
          <button type="submit" disabled={loading} className="ldd-btn-gold w-full justify-center" data-testid="admin-login-submit">
            {loading ? "Entrando…" : "Acceder"}
          </button>
        </form>
        <div className="text-center mt-8 text-xs" style={{ color: "rgba(250,248,245,0.4)" }}>
          ¿No eres admin? <a href="/" className="hover:text-[#C5A059]">Ir a la tienda</a>
        </div>
      </div>
    </div>
  );
}
