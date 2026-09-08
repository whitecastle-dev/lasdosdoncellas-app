import React from "react";
import { Calendar as CalendarIcon, Bot } from "lucide-react";
import PortalTable from "./PortalTable";

export function CalendarioEventos() {
  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <div className="label-eyebrow text-gray-500">Espejo del portal · Solo lectura</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
          <CalendarIcon size={28} className="text-[#C5A059]" />
          Calendario de Eventos
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Servicios de corte y eventos programados en el portal. Datos en vivo.
        </p>
      </div>
      <PortalTable
        testId="portal-calendario"
        table="servicios_corte"
        select="id,fecha,hora_inicio,hora_fin,cliente,ubicacion,tipo_servicio,num_piezas,precio_servicio,gastos,estado,observaciones"
        order="fecha.desc"
        limit={500}
        searchKeys={["cliente", "ubicacion"]}
        columns={[
          { key: "fecha", label: "Fecha", type: "date" },
          { key: "hora_inicio", label: "H. inicio" },
          { key: "hora_fin", label: "H. fin" },
          { key: "cliente", label: "Cliente" },
          { key: "ubicacion", label: "Ubicación" },
          { key: "tipo_servicio", label: "Tipo", badge: true },
          { key: "num_piezas", label: "Piezas", type: "number" },
          { key: "precio_servicio", label: "Precio", type: "money" },
          { key: "gastos", label: "Gastos", type: "money" },
          { key: "estado", label: "Estado", badge: true },
        ]}
      />
    </div>
  );
}

export function IaEmpresarial() {
  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <div className="label-eyebrow text-gray-500">Espejo del portal · Solo lectura</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1 flex items-center gap-3">
          <Bot size={28} className="text-[#C5A059]" />
          IA Empresarial
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Conversaciones activas y sugerencias generadas por la IA del portal.
        </p>
      </div>
      <PortalTable
        testId="portal-ia"
        table="notifications"
        select="*"
        order="created_at.desc"
        limit={200}
        columns={[
          { key: "created_at", label: "Fecha", type: "datetime" },
          { key: "titulo", label: "Título" },
          { key: "mensaje", label: "Mensaje" },
          { key: "tipo", label: "Tipo", badge: true },
          { key: "leido", label: "Leído", type: "bool" },
        ]}
        emptyMessage="Sin notificaciones IA por ahora."
      />
    </div>
  );
}
