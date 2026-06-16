import React, { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import { useCustomer } from "@/context/CustomerContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function CustomerRegister() {
  const { customer, register } = useCustomer();
  // Estado actualizado para first_name y last_name
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  
  if (customer) return <Navigate to="/cuenta" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Cuenta creada. Por favor, revisa tu correo para verificar tu cuenta.");
      nav("/cuenta/login");
    } catch (err) { toast.error(formatApiError(err)); } finally { setLoading(false); }
  };

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => {}} />
      <div className="max-w-md mx-auto px-6 py-20">
        <div className="label-eyebrow gold mb-3">Nueva cuenta</div>
        <h1 className="font-serif text-4xl tracking-tighter" style={{ color: "#FAF8F5" }}>Únete</h1>
        <p className="mt-3 text-sm" style={{ color: "rgba(250,248,245,0.6)" }}>
          Crea tu cuenta para guardar direcciones y comprar en un clic con el botón <span className="gold">Comprar ya</span>.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4" data-testid="customer-register-form">
          <div className="flex gap-4">
            <Field label="Nombre *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required testid="customer-register-first-name" />
            <Field label="Apellidos *" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required testid="customer-register-last-name" />
          </div>
          <Field label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required testid="customer-register-email" />
          <Field label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} testid="customer-register-phone" />
          
          <div className="relative">
            <Field 
              label="Contraseña *" 
              type={showPassword ? "text" : "password"} 
              placeholder="Mín 8, mayús, minús, número" 
              value={form.password} 
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
              required 
              testid="customer-register-password" 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-xs gold hover:underline"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          <button disabled={loading} className="ldd-btn-gold w-full justify-center" data-testid="customer-register-submit">
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>
        <div className="mt-6 text-sm text-center" style={{ color: "rgba(250,248,245,0.6)" }}>
          ¿Ya tienes cuenta? <Link to="/cuenta/login" className="gold hover:underline">Acceder</Link>
        </div>
      </div>
      <StoreFooter />
    </div>
  );
}

function Field({ label, testid, ...rest }) {
  return (
    <div className="flex-1">
      <label className="label-eyebrow gold block mb-2">{label}</label>
      <input data-testid={testid} {...rest} className="w-full bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5