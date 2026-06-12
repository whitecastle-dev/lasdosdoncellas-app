import React, { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import { useCustomer } from "@/context/CustomerContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function CustomerLogin() {
  const { customer, login } = useCustomer();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  if (customer) return <Navigate to="/cuenta" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bienvenido");
      nav("/cuenta");
    } catch (err) { toast.error(formatApiError(err)); } finally { setLoading(false); }
  };

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => {}} />
      <div className="max-w-md mx-auto px-6 py-20">
        <div className="label-eyebrow gold mb-3">Acceso</div>
        <h1 className="font-serif text-4xl tracking-tighter" style={{ color: "#FAF8F5" }}>Mi cuenta</h1>
        <form onSubmit={submit} className="mt-10 space-y-5" data-testid="customer-login-form">
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required testid="customer-login-email" />
          <Field label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required testid="customer-login-password" />
          <button disabled={loading} className="ldd-btn-gold w-full justify-center" data-testid="customer-login-submit">
            {loading ? "Entrando…" : "Acceder"}
          </button>
        </form>
        <div className="mt-8 text-sm text-center" style={{ color: "rgba(250,248,245,0.6)" }}>
          ¿No tienes cuenta?{" "}
          <Link to="/cuenta/registro" className="gold hover:underline" data-testid="customer-login-register-link">Regístrate</Link>
        </div>
        <div className="mt-6 pt-6 border-t border-[rgba(197,160,89,0.18)] text-xs text-center" style={{ color: "rgba(250,248,245,0.45)" }}>
          Próximamente: acceso con <span className="gold">Google</span> y Microsoft.
        </div>
      </div>
      <StoreFooter />
    </div>
  );
}

function Field({ label, testid, ...rest }) {
  return (
    <div>
      <label className="label-eyebrow gold block mb-2">{label}</label>
      <input data-testid={testid} {...rest} className="w-full bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-4 py-3 text-sm" />
    </div>
  );
}
