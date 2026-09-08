import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Banknote, LayoutDashboard, Receipt, Calculator, Wallet, Landmark,
  ArrowDownRight, FileText, ScanLine, Building2, Shield } from "lucide-react";
import PortalHubLayout from "./PortalHubLayout";
import PortalTable from "./PortalTable";

const BASE = "/admin/portal/finanzas";

const TABS = [
  { to: "", end: true, label: "Panel", icon: LayoutDashboard },
  { to: "facturacion", label: "Facturación", icon: Receipt },
  { to: "contabilidad", label: "Contabilidad", icon: Calculator },
  { to: "tesoreria", label: "Tesorería", icon: Wallet },
  { to: "bancos", label: "Bancos y Conciliación", icon: Landmark },
  { to: "gastos", label: "Gastos", icon: ArrowDownRight },
  { to: "albaranes", label: "Albaranes", icon: FileText },
  { to: "ocr", label: "OCR Facturas", icon: ScanLine },
  { to: "centros-coste", label: "Centros de Coste", icon: Building2 },
  { to: "auditoria", label: "Auditoría Total", icon: Shield },
];

function Layout() {
  return (
    <PortalHubLayout
      title="Finanzas Corporativas"
      subtitle="Facturación, contabilidad, tesorería, gastos y auditoría a nivel empresa. Datos vivos del portal."
      icon={Banknote}
      base={BASE}
      tabs={TABS}
    />
  );
}

const Panel = () => (<div className="text-sm text-gray-500">Los apartados más críticos son <strong>Gastos pendientes</strong>, <strong>Tesorería</strong> y <strong>Bancos</strong>.</div>);

const Facturacion = () => (
  <PortalTable
    testId="portal-f-facturacion"
    table="fin_facturas"
    select="id,fecha,tipo,base_imponible,iva_importe,total,cobrado_pagado,pendiente,estado,departamento"
    order="fecha.desc"
    limit={1000}
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "tipo", label: "Tipo", badge: true },
      { key: "departamento", label: "Departamento", badge: true },
      { key: "base_imponible", label: "Base", type: "money" },
      { key: "iva_importe", label: "IVA", type: "money" },
      { key: "total", label: "Total", type: "money" },
      { key: "cobrado_pagado", label: "Cobrado/Pagado", type: "money" },
      { key: "pendiente", label: "Pendiente", type: "money" },
      { key: "estado", label: "Estado", badge: true },
    ]}
  />
);

const Tesoreria = () => (
  <PortalTable
    testId="portal-f-tesoreria"
    table="fin_movimientos_tesoreria"
    select="id,fecha,concepto,tipo,entrada,salida,saldo_resultante,departamento,es_prevision,conciliado,referencia"
    order="fecha.desc"
    limit={1000}
    searchKeys={["concepto", "referencia"]}
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "concepto", label: "Concepto" },
      { key: "tipo", label: "Tipo", badge: true },
      { key: "entrada", label: "Entrada", type: "money" },
      { key: "salida", label: "Salida", type: "money" },
      { key: "saldo_resultante", label: "Saldo", type: "money" },
      { key: "departamento", label: "Depto", badge: true },
      { key: "conciliado", label: "Concil.", type: "bool" },
      { key: "es_prevision", label: "Previsión", type: "bool" },
    ]}
  />
);

const Bancos = () => (
  <PortalTable
    testId="portal-f-bancos"
    table="fin_cuentas"
    select="id,nombre,tipo,banco,iban,titular,saldo_inicial,saldo_actual,activa,observaciones"
    order="tipo.asc"
    limit={200}
    columns={[
      { key: "nombre", label: "Cuenta" },
      { key: "tipo", label: "Tipo", badge: true },
      { key: "banco", label: "Banco" },
      { key: "iban", label: "IBAN" },
      { key: "titular", label: "Titular" },
      { key: "saldo_inicial", label: "Saldo inic.", type: "money" },
      { key: "saldo_actual", label: "Saldo act.", type: "money" },
      { key: "activa", label: "Activa", type: "bool" },
    ]}
  />
);

const Gastos = () => (
  <PortalTable
    testId="portal-f-gastos"
    table="fin_gastos"
    select="id,fecha,proveedor,proveedor_cif,descripcion,categoria,tipo,departamento,base_imponible,iva_importe,total,estado,fecha_vencimiento,forma_pago,es_prevision,numero_factura"
    order="fecha.desc"
    limit={1000}
    searchKeys={["proveedor", "numero_factura", "descripcion"]}
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "numero_factura", label: "Nº fact." },
      { key: "proveedor", label: "Proveedor" },
      { key: "categoria", label: "Categoría", badge: true },
      { key: "departamento", label: "Depto", badge: true },
      { key: "tipo", label: "Tipo", badge: true },
      { key: "base_imponible", label: "Base", type: "money" },
      { key: "total", label: "Total", type: "money" },
      { key: "estado", label: "Estado", badge: true },
      { key: "fecha_vencimiento", label: "Vence", type: "date" },
    ]}
  />
);

const CentrosCoste = () => (
  <PortalTable
    testId="portal-f-cc"
    table="fin_centros_coste"
    select="id,codigo,nombre,tipo,descripcion,activo,created_at"
    order="codigo.asc"
    limit={500}
    searchKeys={["codigo", "nombre"]}
    columns={[
      { key: "codigo", label: "Código" },
      { key: "nombre", label: "Nombre" },
      { key: "tipo", label: "Tipo", badge: true },
      { key: "descripcion", label: "Descripción" },
      { key: "activo", label: "Activo", type: "bool" },
    ]}
  />
);

export default function FinanzasRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Panel />} />
        <Route path="facturacion" element={<Facturacion />} />
        <Route path="contabilidad" element={<Facturacion />} />
        <Route path="tesoreria" element={<Tesoreria />} />
        <Route path="bancos" element={<Bancos />} />
        <Route path="gastos" element={<Gastos />} />
        <Route path="albaranes" element={<Facturacion />} />
        <Route path="ocr" element={<Facturacion />} />
        <Route path="centros-coste" element={<CentrosCoste />} />
        <Route path="auditoria" element={<Facturacion />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
    </Routes>
  );
}
