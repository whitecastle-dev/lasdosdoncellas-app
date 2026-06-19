import React, { useState } from "react";
import { useCustomer } from "@/context/CustomerContext";
import { customerApi } from "@/context/CustomerContext";

export default function Profile() {
  const { customer, refresh } = useCustomer();
  const [formData, setFormData] = useState({ name: customer?.name || "", email: customer?.email || "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await customerApi.put("/me", formData);
    await refresh();
    alert("Perfil actualizado");
  };

  return (
    <div className="max-w-2xl mx-auto p-6 text-white">
      <h1 className="text-2xl mb-6">Mi Perfil</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input className="bg-neutral-900 p-2 border" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nombre" />
        <input className="bg-neutral-900 p-2 border" value={formData.email} disabled />
        <button type="submit" className="bg-[#C5A059] text-black py-2">Guardar cambios</button>
      </form>
    </div>
  );
}