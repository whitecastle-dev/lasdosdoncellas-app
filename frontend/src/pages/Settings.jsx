import React, { useState } from "react";
import { customerApi } from "@/context/CustomerContext";

export default function Settings() {
  const [passwords, setPasswords] = useState({ current: "", new: "" });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    await customerApi.post("/change-password", passwords);
    alert("Contraseña actualizada");
  };

  return (
    <div className="max-w-2xl mx-auto p-6 text-white">
      <h1 className="text-2xl mb-6">Configuración</h1>
      <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
        <input className="bg-neutral-900 p-2 border" type="password" placeholder="Contraseña actual" onChange={e => setPasswords({...passwords, current: e.target.value})} />
        <input className="bg-neutral-900 p-2 border" type="password" placeholder="Nueva contraseña" onChange={e => setPasswords({...passwords, new: e.target.value})} />
        <button type="submit" className="bg-[#C5A059] text-black py-2">Cambiar contraseña</button>
      </form>
    </div>
  );
}