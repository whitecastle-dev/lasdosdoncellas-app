import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ShoppingBag, LayoutDashboard, Boxes, Package, Coins, ArrowLeftRight,
  Truck, ShoppingCart, TrendingUp, DollarSign, CreditCard, Wifi, Wallet } from "lucide-react";
import PortalHubLayout from "./PortalHubLayout";
import PortalTable from "./PortalTable";

const BASE = "/admin/portal/tienda";

const TABS = [
  { to: "", end: true, label: "Panel", icon: LayoutDashboard },
  { to: "inventario", label: "Inventario", icon: Boxes },
  { to: "productos", label: "Productos", icon: Package },
  { to: "precios", label: "Precios", icon: Coins },
  { to: "movimientos", label: "Movimientos stock", icon: ArrowLeftRight },
  { to: "proveedores", label: "Proveedores", icon: Truck },
  { to: "compras", label: "Compras", icon: ShoppingCart },
  { to: "ventas", label: "Ventas", icon: TrendingUp },
  { to: "caja", label: "Caja diaria", icon: DollarSign },
  { to: "tpv-fisico", label: "TPV Físico", icon: CreditCard },
  { to: "tpv-online", label: "TPV Online", icon: Wifi },
  { to: "pedidos-web", label: "Pedidos Web", icon: ShoppingCart },
  { to: "finanzas", label: "Finanzas", icon: Wallet },
];

function Layout() {
  return (
    <PortalHubLayout
      title="Tienda General"
      subtitle="Inventario, precios, compras, ventas y TPV de la tienda física y online. Datos vivos del portal."
      icon={ShoppingBag}
      base={BASE}
      tabs={TABS}
    />
  );
}

const Panel = () => (
  <div className="text-sm text-gray-500">Selecciona una pestaña para consultar los datos vivos. TPV Online y Pedidos Web se alimentan también desde nuestra tienda web.</div>
);

const Inventario = () => (
  <PortalTable
    testId="portal-t-inventario"
    table="inventario_actual"
    select="id,producto_id,stock_actual,stock_reservado,stock_disponible,coste_medio,ultimo_coste,ultima_actualizacion,almacen_id"
    order="ultima_actualizacion.desc"
    limit={1000}
    columns={[
      { key: "producto_id", label: "Producto (id)" },
      { key: "stock_actual", label: "Stock actual", type: "number" },
      { key: "stock_reservado", label: "Reservado", type: "number" },
      { key: "stock_disponible", label: "Disponible", type: "number" },
      { key: "coste_medio", label: "Coste medio", type: "money" },
      { key: "ultimo_coste", label: "Últ. coste", type: "money" },
      { key: "ultima_actualizacion", label: "Actualizado", type: "datetime" },
    ]}
  />
);

const FamiliasProducto = () => (
  <PortalTable
    testId="portal-t-familias"
    table="familias_producto"
    select="id,nombre,descripcion,activo,orden,margen_objetivo,iva_defecto,recargo_defecto,codigo_epelsa,epelsa_sync_enabled,created_at"
    order="orden.asc"
    limit={500}
    searchKeys={["nombre", "codigo_epelsa"]}
    columns={[
      { key: "nombre", label: "Familia" },
      { key: "descripcion", label: "Descripción" },
      { key: "margen_objetivo", label: "Margen obj. %", type: "number" },
      { key: "iva_defecto", label: "IVA %", type: "number" },
      { key: "codigo_epelsa", label: "Cod. Epelsa" },
      { key: "epelsa_sync_enabled", label: "Sync Epelsa", type: "bool" },
      { key: "activo", label: "Activa", type: "bool" },
    ]}
  />
);

const FacturasCompra = () => (
  <PortalTable
    testId="portal-t-facturas-compra"
    table="facturas_compra"
    select="id,fecha_factura,numero_factura,proveedor_id,proveedor_detectado_nombre,base_imponible,iva,total,estado_pago,fecha_vencimiento,forma_pago,fecha_pago,importe_pagado,pendiente_pago"
    order="fecha_factura.desc"
    limit={500}
    searchKeys={["numero_factura", "proveedor_detectado_nombre"]}
    columns={[
      { key: "fecha_factura", label: "Fecha", type: "date" },
      { key: "numero_factura", label: "Nº factura" },
      { key: "proveedor_detectado_nombre", label: "Proveedor" },
      { key: "base_imponible", label: "Base", type: "money" },
      { key: "iva", label: "IVA", type: "money" },
      { key: "total", label: "Total", type: "money" },
      { key: "estado_pago", label: "Pago", badge: true },
      { key: "importe_pagado", label: "Pagado", type: "money" },
      { key: "pendiente_pago", label: "Pendiente", type: "money" },
      { key: "fecha_vencimiento", label: "Vence", type: "date" },
    ]}
  />
);

export default function TiendaRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Panel />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="productos" element={<FamiliasProducto />} />
        <Route path="precios" element={<FamiliasProducto />} />
        <Route path="movimientos" element={<Inventario />} />
        <Route path="proveedores" element={<FacturasCompra />} />
        <Route path="compras" element={<FacturasCompra />} />
        <Route path="ventas" element={<Panel />} />
        <Route path="caja" element={<Panel />} />
        <Route path="tpv-fisico" element={<Panel />} />
        <Route path="tpv-online" element={<Panel />} />
        <Route path="pedidos-web" element={<Panel />} />
        <Route path="finanzas" element={<FacturasCompra />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
    </Routes>
  );
}
