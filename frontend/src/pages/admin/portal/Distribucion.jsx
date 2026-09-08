import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Truck, LayoutDashboard, Boxes, Users, ClipboardList, FileText,
  Receipt, ArrowDownRight, ArrowUpRight, Calculator, Wallet } from "lucide-react";
import PortalHubLayout from "./PortalHubLayout";
import PortalTable from "./PortalTable";

const BASE = "/admin/portal/distribucion";

const TABS = [
  { to: "", end: true, label: "Panel", icon: LayoutDashboard },
  { to: "inventario", label: "Inventario", icon: Boxes },
  { to: "clientes", label: "Clientes", icon: Users },
  { to: "pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "facturas-entrantes", label: "Fact. entrantes", icon: FileText },
  { to: "facturas-salientes", label: "Fact. salientes", icon: Receipt },
  { to: "cobros", label: "Cobros", icon: ArrowUpRight },
  { to: "pagos", label: "Pagos", icon: ArrowDownRight },
  { to: "contabilidad", label: "Contabilidad", icon: Calculator },
  { to: "finanzas", label: "Finanzas", icon: Wallet },
];

function Layout() {
  return (
    <PortalHubLayout
      title="Distribución"
      subtitle="Canal de distribución B2B: pedidos, albaranes, facturas, cobros y pagos. Datos vivos del portal."
      icon={Truck}
      base={BASE}
      tabs={TABS}
    />
  );
}

const Panel = () => (<div className="text-sm text-gray-500">Selecciona una pestaña. Facturas y cobros pendientes son los más consultados a diario.</div>);

const Clientes = () => (
  <PortalTable
    testId="portal-d-clientes"
    table="clientes"
    select="id,nombre,nombre_comercial,nif_cif,categoria,telefono,email,poblacion,provincia,cliente_distribucion,activo,created_at"
    filters={{ cliente_distribucion: "eq.true" }}
    order="nombre.asc"
    limit={500}
    searchKeys={["nombre", "nombre_comercial", "nif_cif", "poblacion"]}
    columns={[
      { key: "nombre", label: "Nombre" },
      { key: "nombre_comercial", label: "Comercial" },
      { key: "nif_cif", label: "NIF/CIF" },
      { key: "categoria", label: "Categoría", badge: true },
      { key: "poblacion", label: "Población" },
      { key: "provincia", label: "Provincia" },
      { key: "telefono", label: "Teléfono" },
      { key: "email", label: "Email" },
      { key: "activo", label: "Activo", type: "bool" },
    ]}
  />
);

const FinFacturasEmitidas = () => (
  <PortalTable
    testId="portal-d-facturas-salientes"
    table="fin_facturas"
    select="id,fecha,tipo,base_imponible,iva_importe,total,cobrado_pagado,pendiente,estado,departamento"
    filters={{ tipo: "eq.EMITIDA", departamento: "eq.DISTRIBUCION" }}
    order="fecha.desc"
    limit={500}
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "base_imponible", label: "Base", type: "money" },
      { key: "iva_importe", label: "IVA", type: "money" },
      { key: "total", label: "Total", type: "money" },
      { key: "cobrado_pagado", label: "Cobrado", type: "money" },
      { key: "pendiente", label: "Pendiente", type: "money" },
      { key: "estado", label: "Estado", badge: true },
    ]}
  />
);

const FinFacturasRecibidas = () => (
  <PortalTable
    testId="portal-d-facturas-entrantes"
    table="fin_facturas"
    select="id,fecha,tipo,base_imponible,iva_importe,total,cobrado_pagado,pendiente,estado,departamento"
    filters={{ tipo: "eq.RECIBIDA", departamento: "eq.DISTRIBUCION" }}
    order="fecha.desc"
    limit={500}
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "base_imponible", label: "Base", type: "money" },
      { key: "iva_importe", label: "IVA", type: "money" },
      { key: "total", label: "Total", type: "money" },
      { key: "cobrado_pagado", label: "Pagado", type: "money" },
      { key: "pendiente", label: "Pendiente", type: "money" },
      { key: "estado", label: "Estado", badge: true },
    ]}
  />
);

const Movimientos = ({ tipo }) => (
  <PortalTable
    testId={`portal-d-mov-${tipo}`}
    table="fin_movimientos_tesoreria"
    select="id,fecha,concepto,tipo,entrada,salida,saldo_resultante,departamento,es_prevision,conciliado"
    filters={{ departamento: "eq.DISTRIBUCION", tipo: `eq.${tipo}` }}
    order="fecha.desc"
    limit={500}
    searchKeys={["concepto"]}
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "concepto", label: "Concepto" },
      { key: "entrada", label: "Entrada", type: "money" },
      { key: "salida", label: "Salida", type: "money" },
      { key: "saldo_resultante", label: "Saldo", type: "money" },
      { key: "conciliado", label: "Concil.", type: "bool" },
      { key: "es_prevision", label: "Previsión", type: "bool" },
    ]}
  />
);

export default function DistribucionRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Panel />} />
        <Route path="inventario" element={<Panel />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="pedidos" element={<FinFacturasEmitidas />} />
        <Route path="facturas-entrantes" element={<FinFacturasRecibidas />} />
        <Route path="facturas-salientes" element={<FinFacturasEmitidas />} />
        <Route path="cobros" element={<Movimientos tipo="ENTRADA" />} />
        <Route path="pagos" element={<Movimientos tipo="SALIDA" />} />
        <Route path="contabilidad" element={<FinFacturasEmitidas />} />
        <Route path="finanzas" element={<FinFacturasEmitidas />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
    </Routes>
  );
}
