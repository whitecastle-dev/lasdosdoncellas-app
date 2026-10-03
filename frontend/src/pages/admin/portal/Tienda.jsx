import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ShoppingBag, LayoutDashboard, Boxes, Package, Coins, ArrowLeftRight,
  Truck, ShoppingCart, TrendingUp, DollarSign, CreditCard, Wifi, Wallet, Layers } from "lucide-react";
import PortalHubLayout from "./PortalHubLayout";
import PortalTable from "./PortalTable";

const BASE = "/admin/portal/tienda";

const TABS = [
  { to: "", end: true, label: "Panel", icon: LayoutDashboard },
  { to: "inventario", label: "Inventario", icon: Boxes },
  { to: "productos", label: "Productos", icon: Package },
  { to: "familias", label: "Familias", icon: Layers },
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
    table="v_inventario_valorado"
    select="id,producto_nombre,codigo_interno,ean,familia_nombre,stock_actual,stock_reservado,stock_disponible,stock_minimo,coste_medio,pvp_venta,margen_real,valor_coste_sin_iva,valor_pvp,ultima_actualizacion"
    order="producto_nombre.asc"
    limit={1000}
    searchKeys={["producto_nombre", "codigo_interno", "ean", "familia_nombre"]}
    columns={[
      { key: "producto_nombre", label: "Producto" },
      { key: "codigo_interno", label: "Código" },
      { key: "familia_nombre", label: "Familia", badge: true },
      { key: "stock_actual", label: "Stock", type: "number" },
      { key: "stock_disponible", label: "Disponible", type: "number" },
      { key: "stock_minimo", label: "Mínimo", type: "number" },
      { key: "coste_medio", label: "Coste medio", type: "money" },
      { key: "pvp_venta", label: "PVP", type: "money" },
      { key: "margen_real", label: "Margen %", type: "number" },
      { key: "valor_coste_sin_iva", label: "Valor coste", type: "money" },
      { key: "ultima_actualizacion", label: "Actualizado", type: "datetime" },
    ]}
  />
);

const Productos = () => (
  <PortalTable
    testId="portal-t-productos"
    table="tienda_productos"
    select="id,codigo_interno,ean,plu,nombre,unidad_venta,venta_por_peso,tipo_iva,precio_compra,pvp_venta,pvp_sin_iva,margen_objetivo,margen_real,stock_minimo,activo,epelsa_sync_status,updated_at"
    order="nombre.asc"
    limit={1000}
    searchKeys={["nombre", "codigo_interno", "ean", "plu"]}
    columns={[
      { key: "nombre", label: "Producto" },
      { key: "codigo_interno", label: "Código" },
      { key: "ean", label: "EAN" },
      { key: "unidad_venta", label: "Ud.", badge: true },
      { key: "tipo_iva", label: "IVA %", type: "number" },
      { key: "precio_compra", label: "Compra", type: "money" },
      { key: "pvp_venta", label: "PVP", type: "money" },
      { key: "margen_real", label: "Margen %", type: "number" },
      { key: "epelsa_sync_status", label: "Epelsa", badge: true },
      { key: "activo", label: "Activo", type: "bool" },
      { key: "updated_at", label: "Actualizado", type: "datetime" },
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

const Precios = () => (
  <PortalTable
    testId="portal-t-precios"
    table="historico_cambios_pvp"
    select="id,created_at,producto_id,pvp_anterior,pvp_nuevo,coste_real,margen_anterior,margen_nuevo,usuario,origen,estado_sync_epelsa,notas"
    order="created_at.desc"
    limit={500}
    searchKeys={["usuario", "origen", "notas"]}
    emptyMessage="Todavía no hay cambios de PVP registrados en el portal."
    columns={[
      { key: "created_at", label: "Fecha", type: "datetime" },
      { key: "producto_id", label: "Producto (id)" },
      { key: "pvp_anterior", label: "PVP anterior", type: "money" },
      { key: "pvp_nuevo", label: "PVP nuevo", type: "money" },
      { key: "coste_real", label: "Coste", type: "money" },
      { key: "margen_nuevo", label: "Margen %", type: "number" },
      { key: "origen", label: "Origen", badge: true },
      { key: "estado_sync_epelsa", label: "Epelsa", badge: true },
      { key: "usuario", label: "Usuario" },
    ]}
  />
);

const Movimientos = () => (
  <PortalTable
    testId="portal-t-movimientos"
    table="movimientos_stock"
    select="id,created_at,producto_id,tipo_movimiento,cantidad,coste_unitario,referencia_tipo,usuario,observaciones"
    order="created_at.desc"
    limit={500}
    searchKeys={["tipo_movimiento", "referencia_tipo", "usuario", "observaciones"]}
    columns={[
      { key: "created_at", label: "Fecha", type: "datetime" },
      { key: "producto_id", label: "Producto (id)" },
      { key: "tipo_movimiento", label: "Tipo", badge: true },
      { key: "cantidad", label: "Cantidad", type: "number" },
      { key: "coste_unitario", label: "Coste ud.", type: "money" },
      { key: "referencia_tipo", label: "Referencia", badge: true },
      { key: "usuario", label: "Usuario" },
      { key: "observaciones", label: "Observaciones" },
    ]}
  />
);

const Proveedores = () => (
  <PortalTable
    testId="portal-t-proveedores"
    table="proveedores"
    select="id,codigo,nombre,nombre_comercial,nif_cif,contacto_principal,telefono,email,localidad,provincia,forma_pago"
    order="nombre.asc"
    limit={500}
    searchKeys={["nombre", "nombre_comercial", "nif_cif", "localidad"]}
    columns={[
      { key: "codigo", label: "Código" },
      { key: "nombre", label: "Proveedor" },
      { key: "nombre_comercial", label: "Comercial" },
      { key: "nif_cif", label: "NIF/CIF" },
      { key: "contacto_principal", label: "Contacto" },
      { key: "telefono", label: "Teléfono" },
      { key: "email", label: "Email" },
      { key: "localidad", label: "Localidad" },
      { key: "forma_pago", label: "Forma pago", badge: true },
    ]}
  />
);

const Compras = () => (
  <PortalTable
    testId="portal-t-compras"
    table="facturas_compra"
    select="id,fecha_factura,numero_factura,proveedor_id,base_imponible,iva,total,estado,observaciones,created_at"
    order="fecha_factura.desc"
    limit={500}
    searchKeys={["numero_factura", "observaciones"]}
    columns={[
      { key: "fecha_factura", label: "Fecha", type: "date" },
      { key: "numero_factura", label: "Nº factura" },
      { key: "proveedor_id", label: "Proveedor (id)" },
      { key: "base_imponible", label: "Base", type: "money" },
      { key: "iva", label: "IVA", type: "money" },
      { key: "total", label: "Total", type: "money" },
      { key: "estado", label: "Estado", badge: true },
    ]}
  />
);

const VENTA_COLS = [
  { key: "fecha", label: "Fecha", type: "datetime" },
  { key: "numero_venta", label: "Nº venta" },
  { key: "canal", label: "Canal", badge: true },
  { key: "base_imponible", label: "Base", type: "money" },
  { key: "iva", label: "IVA", type: "money" },
  { key: "total", label: "Total", type: "money" },
  { key: "forma_pago", label: "Pago", badge: true },
  { key: "estado", label: "Estado", badge: true },
  { key: "origen", label: "Origen" },
  { key: "observaciones", label: "Observaciones" },
];

const Ventas = ({ canal, testId = "portal-t-ventas", emptyMessage }) => (
  <PortalTable
    testId={testId}
    table="ventas"
    select="id,numero_venta,fecha,canal,base_imponible,iva,total,forma_pago,estado,observaciones,origen"
    filters={canal ? { canal: `eq.${canal}` } : {}}
    order="fecha.desc"
    limit={500}
    searchKeys={["numero_venta", "observaciones", "origen"]}
    emptyMessage={emptyMessage}
    columns={VENTA_COLS}
  />
);

const Caja = () => (
  <PortalTable
    testId="portal-t-caja"
    table="caja_diaria"
    select="id,fecha,apertura,efectivo,tarjeta,bizum,transferencia,gastos,cierre,efectivo_contado,diferencia,estado,observaciones"
    order="fecha.desc"
    limit={365}
    emptyMessage="Sin cierres de caja registrados todavía en el portal."
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "apertura", label: "Apertura", type: "money" },
      { key: "efectivo", label: "Efectivo", type: "money" },
      { key: "tarjeta", label: "Tarjeta", type: "money" },
      { key: "bizum", label: "Bizum", type: "money" },
      { key: "transferencia", label: "Transfer.", type: "money" },
      { key: "gastos", label: "Gastos", type: "money" },
      { key: "cierre", label: "Cierre", type: "money" },
      { key: "diferencia", label: "Diferencia", type: "money" },
      { key: "estado", label: "Estado", badge: true },
    ]}
  />
);

const TpvFisico = () => (
  <PortalTable
    testId="portal-t-tpv-fisico"
    table="epelsa_tickets"
    select="id,fecha,numero_ticket,balanza_codigo,vendedor_nombre,cliente_nombre,lineas_numero,total_peso,base_imponible,iva_importe,total,forma_pago,estado"
    order="fecha.desc"
    limit={500}
    searchKeys={["numero_ticket", "vendedor_nombre", "cliente_nombre"]}
    columns={[
      { key: "fecha", label: "Fecha", type: "datetime" },
      { key: "numero_ticket", label: "Ticket" },
      { key: "balanza_codigo", label: "Balanza" },
      { key: "vendedor_nombre", label: "Vendedor" },
      { key: "cliente_nombre", label: "Cliente" },
      { key: "lineas_numero", label: "Líneas", type: "number" },
      { key: "total_peso", label: "Peso", type: "number" },
      { key: "base_imponible", label: "Base", type: "money" },
      { key: "iva_importe", label: "IVA", type: "money" },
      { key: "total", label: "Total", type: "money" },
      { key: "forma_pago", label: "Pago", badge: true },
      { key: "estado", label: "Estado", badge: true },
    ]}
  />
);

const Finanzas = () => (
  <PortalTable
    testId="portal-t-finanzas"
    table="pagos_facturas_compra"
    select="id,fecha_pago,factura_compra_id,importe,forma_pago,referencia,observaciones,created_at"
    order="fecha_pago.desc"
    limit={500}
    searchKeys={["referencia", "observaciones"]}
    columns={[
      { key: "fecha_pago", label: "Fecha pago", type: "date" },
      { key: "factura_compra_id", label: "Factura (id)" },
      { key: "importe", label: "Importe", type: "money" },
      { key: "forma_pago", label: "Forma pago", badge: true },
      { key: "referencia", label: "Referencia" },
      { key: "observaciones", label: "Observaciones" },
    ]}
  />
);

export default function TiendaRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Panel />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="productos" element={<Productos />} />
        <Route path="familias" element={<FamiliasProducto />} />
        <Route path="precios" element={<Precios />} />
        <Route path="movimientos" element={<Movimientos />} />
        <Route path="proveedores" element={<Proveedores />} />
        <Route path="compras" element={<Compras />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="caja" element={<Caja />} />
        <Route path="tpv-fisico" element={<TpvFisico />} />
        <Route path="tpv-online" element={<Ventas canal="ONLINE" testId="portal-t-tpv-online" emptyMessage="Aún no hay ventas online enviadas desde la tienda web." />} />
        <Route path="pedidos-web" element={<Ventas canal="ONLINE" testId="portal-t-pedidos-web" emptyMessage="Aún no hay pedidos web enviados al portal." />} />
        <Route path="finanzas" element={<Finanzas />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
    </Routes>
  );
}
