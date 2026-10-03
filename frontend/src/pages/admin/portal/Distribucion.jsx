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
    filters={{ tipo: `eq.${tipo}` }}
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

const Inventario = () => (
  <PortalTable
    testId="portal-d-inventario"
    table="v_inventario_valorado"
    select="id,producto_nombre,codigo_interno,familia_nombre,stock_actual,stock_reservado,stock_disponible,coste_medio,pvp_venta,valor_coste_sin_iva,ultima_actualizacion"
    order="producto_nombre.asc"
    limit={1000}
    searchKeys={["producto_nombre", "codigo_interno", "familia_nombre"]}
    columns={[
      { key: "producto_nombre", label: "Producto" },
      { key: "codigo_interno", label: "Código" },
      { key: "familia_nombre", label: "Familia", badge: true },
      { key: "stock_actual", label: "Stock", type: "number" },
      { key: "stock_reservado", label: "Reservado", type: "number" },
      { key: "stock_disponible", label: "Disponible", type: "number" },
      { key: "coste_medio", label: "Coste medio", type: "money" },
      { key: "pvp_venta", label: "PVP", type: "money" },
      { key: "valor_coste_sin_iva", label: "Valor coste", type: "money" },
      { key: "ultima_actualizacion", label: "Actualizado", type: "datetime" },
    ]}
  />
);

const Pedidos = () => (
  <PortalTable
    testId="portal-d-pedidos"
    table="pedidos"
    select="id,numero,created_at,cliente_manual_nombre,canal,area,estado,estado_pago,estado_stock,modalidad_entrega,fecha_entrega_prevista,forma_pago,subtotal,iva_total,total,prioridad"
    order="created_at.desc"
    limit={500}
    searchKeys={["numero", "cliente_manual_nombre", "canal", "area"]}
    columns={[
      { key: "created_at", label: "Fecha", type: "datetime" },
      { key: "numero", label: "Nº pedido" },
      { key: "cliente_manual_nombre", label: "Cliente" },
      { key: "canal", label: "Canal", badge: true },
      { key: "area", label: "Área", badge: true },
      { key: "estado", label: "Estado", badge: true },
      { key: "estado_pago", label: "Pago", badge: true },
      { key: "estado_stock", label: "Stock", badge: true },
      { key: "modalidad_entrega", label: "Entrega" },
      { key: "fecha_entrega_prevista", label: "Entrega prev.", type: "date" },
      { key: "total", label: "Total", type: "money" },
    ]}
  />
);

const ClientesB2B = () => (
  <PortalTable
    testId="portal-d-clientes-b2b"
    table="clientes_b2b"
    select="id,nombre,nombre_comercial,nif_cif,contacto_principal,telefono,email,poblacion,provincia,tipo_cliente,forma_pago,dias_pago,limite_credito,activo"
    order="nombre.asc"
    limit={500}
    searchKeys={["nombre", "nombre_comercial", "nif_cif", "poblacion"]}
    columns={[
      { key: "nombre", label: "Cliente B2B" },
      { key: "nombre_comercial", label: "Comercial" },
      { key: "nif_cif", label: "NIF/CIF" },
      { key: "tipo_cliente", label: "Tipo", badge: true },
      { key: "poblacion", label: "Población" },
      { key: "telefono", label: "Teléfono" },
      { key: "forma_pago", label: "Pago", badge: true },
      { key: "dias_pago", label: "Días pago", type: "number" },
      { key: "limite_credito", label: "Límite crédito", type: "money" },
      { key: "activo", label: "Activo", type: "bool" },
    ]}
  />
);

const Borradores = () => (
  <PortalTable
    testId="portal-d-borradores"
    table="distribucion_facturas_borrador"
    select="id,fecha,tipo,numero,estado,subtotal,iva_total,total,vencimiento,notas"
    order="fecha.desc"
    limit={500}
    emptyMessage="Sin borradores de factura de distribución."
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "tipo", label: "Tipo", badge: true },
      { key: "numero", label: "Número" },
      { key: "estado", label: "Estado", badge: true },
      { key: "subtotal", label: "Base", type: "money" },
      { key: "iva_total", label: "IVA", type: "money" },
      { key: "total", label: "Total", type: "money" },
      { key: "vencimiento", label: "Vence", type: "date" },
    ]}
  />
);

const GastosDistribucion = () => (
  <PortalTable
    testId="portal-d-gastos"
    table="fin_gastos"
    select="id,fecha,proveedor,descripcion,categoria,tipo,base_imponible,iva_importe,total,estado,fecha_vencimiento,forma_pago,departamento"
    filters={{ departamento: "eq.DISTRIBUCION" }}
    order="fecha.desc"
    limit={500}
    searchKeys={["proveedor", "descripcion", "categoria"]}
    emptyMessage="Sin gastos asignados al departamento de Distribución."
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "proveedor", label: "Proveedor" },
      { key: "descripcion", label: "Descripción" },
      { key: "categoria", label: "Categoría", badge: true },
      { key: "total", label: "Total", type: "money" },
      { key: "estado", label: "Estado", badge: true },
      { key: "fecha_vencimiento", label: "Vence", type: "date" },
    ]}
  />
);

export default function DistribucionRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Panel />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="clientes" element={<ClientesB2B />} />
        <Route path="clientes-portal" element={<Clientes />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="facturas-entrantes" element={<FinFacturasRecibidas />} />
        <Route path="facturas-salientes" element={<FinFacturasEmitidas />} />
        <Route path="cobros" element={<Movimientos tipo="INGRESO" />} />
        <Route path="pagos" element={<Movimientos tipo="GASTO" />} />
        <Route path="contabilidad" element={<Borradores />} />
        <Route path="finanzas" element={<GastosDistribucion />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
    </Routes>
  );
}
