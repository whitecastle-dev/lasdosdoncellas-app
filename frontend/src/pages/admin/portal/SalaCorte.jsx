import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Scissors, LayoutDashboard, Package, Users, Boxes, ClipboardList, Coins, TrendingUp, MapPin, Factory } from "lucide-react";
import PortalHubLayout from "./PortalHubLayout";
import PortalTable from "./PortalTable";

const BASE = "/admin/portal/sala-corte";

const TABS = [
  { to: "", end: true, label: "Panel", icon: LayoutDashboard },
  { to: "plan-trabajo", label: "Plan de Trabajo", icon: ClipboardList },
  { to: "piezas", label: "Registro Piezas", icon: Package },
  { to: "loncheados", label: "Control Loncheados", icon: Factory },
  { to: "trazabilidad", label: "Trazabilidad", icon: MapPin },
  { to: "salarios", label: "Salarios", icon: Coins },
  { to: "rentabilidad", label: "Rentabilidad", icon: TrendingUp },
  { to: "clientes", label: "Clientes", icon: Users },
  { to: "productos", label: "Productos", icon: Package },
  { to: "empleados", label: "Empleados", icon: Users },
];

function Layout() {
  return (
    <PortalHubLayout
      title="CRM Sala Corte"
      subtitle="Producción de loncheado: plan de trabajo, piezas, salarios y rentabilidad por cliente. Datos vivos del portal."
      icon={Scissors}
      base={BASE}
      tabs={TABS}
    />
  );
}

function Panel() {
  return (
    <div className="text-sm text-gray-500">
      Selecciona una pestaña para consultar los datos vivos del portal. Loncheados hoy, salarios del mes y rentabilidad por cliente son las vistas más consultadas.
    </div>
  );
}

const Loncheados = () => (
  <PortalTable
    testId="portal-loncheados"
    table="loncheados"
    select="id,fecha_produccion,cliente_id,empleado_id,producto_id,tipo,peso_loncheado,peso_aprovechado,merma,rendimiento,coste,precio_cliente,lote_interno,lote_externo,estado_rendimiento,trazabilidad_validada,created_at"
    order="created_at.desc"
    limit={500}
    searchKeys={["lote_interno", "lote_externo"]}
    columns={[
      { key: "created_at", label: "Fecha", type: "datetime" },
      { key: "lote_interno", label: "Lote interno" },
      { key: "lote_externo", label: "Lote externo" },
      { key: "tipo", label: "Tipo", badge: true },
      { key: "peso_loncheado", label: "Peso (kg)", type: "number" },
      { key: "rendimiento", label: "Rend.", type: "number" },
      { key: "estado_rendimiento", label: "Rend. estado", badge: true },
      { key: "precio_cliente", label: "Precio cli.", type: "money" },
      { key: "coste", label: "Coste", type: "money" },
      { key: "trazabilidad_validada", label: "Trazab.", type: "bool" },
    ]}
  />
);

const Salarios = () => (
  <PortalTable
    testId="portal-salarios"
    table="salarios"
    select="id,empleado_id,tipo,peso_loncheado,importe,loncheado_id,created_at"
    order="created_at.desc"
    limit={500}
    columns={[
      { key: "created_at", label: "Fecha", type: "datetime" },
      { key: "empleado_id", label: "Empleado (id)" },
      { key: "tipo", label: "Tipo", badge: true },
      { key: "peso_loncheado", label: "Peso lonch. (kg)", type: "number" },
      { key: "importe", label: "Importe", type: "money" },
    ]}
  />
);

const Rentabilidad = () => (
  <PortalTable
    testId="portal-rentabilidad"
    table="ldd_rentabilidad_control"
    select="id,lote_interno,lote_externo,precio_compra_kg,coste_jamon_total,coste_salario,coste_plasticos_total,numero_blisters,precio_venta_blister,ingresos_totales,coste_total,beneficio,rentabilidad_pct,created_at"
    order="created_at.desc"
    limit={500}
    searchKeys={["lote_interno", "lote_externo"]}
    columns={[
      { key: "created_at", label: "Fecha", type: "datetime" },
      { key: "lote_interno", label: "Lote int." },
      { key: "lote_externo", label: "Lote ext." },
      { key: "numero_blisters", label: "Blísters", type: "number" },
      { key: "precio_venta_blister", label: "Precio bl.", type: "money" },
      { key: "ingresos_totales", label: "Ingresos", type: "money" },
      { key: "coste_total", label: "Coste tot.", type: "money" },
      { key: "beneficio", label: "Beneficio", type: "money" },
      { key: "rentabilidad_pct", label: "Rentab. %", type: "number" },
    ]}
  />
);

const Clientes = () => (
  <PortalTable
    testId="portal-sc-clientes"
    table="clientes"
    select="id,nombre,nombre_comercial,nif_cif,categoria,telefono,email,poblacion,provincia,cliente_sala_corte,activo,created_at"
    filters={{ cliente_sala_corte: "eq.true" }}
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

const Productos = () => (
  <PortalTable
    testId="portal-sc-productos"
    table="productos"
    select="id,nombre,categoria,activo,created_at"
    order="nombre.asc"
    limit={500}
    searchKeys={["nombre", "categoria"]}
    columns={[
      { key: "nombre", label: "Producto" },
      { key: "categoria", label: "Categoría", badge: true },
      { key: "activo", label: "Activo", type: "bool" },
      { key: "created_at", label: "Alta", type: "date" },
    ]}
  />
);

const Empleados = () => (
  <PortalTable
    testId="portal-sc-empleados"
    table="empleados"
    select="id,nombre,contacto,rol,activo,created_at"
    order="nombre.asc"
    limit={200}
    searchKeys={["nombre", "contacto", "rol"]}
    columns={[
      { key: "nombre", label: "Empleado" },
      { key: "rol", label: "Rol", badge: true },
      { key: "contacto", label: "Contacto" },
      { key: "activo", label: "Activo", type: "bool" },
      { key: "created_at", label: "Alta", type: "date" },
    ]}
  />
);

const ServiciosCorte = () => (
  <PortalTable
    testId="portal-sc-servicios"
    table="servicios_corte"
    select="id,fecha,hora_inicio,hora_fin,cliente,ubicacion,tipo_servicio,num_piezas,precio_servicio,gastos,estado,created_at"
    order="fecha.desc"
    limit={500}
    searchKeys={["cliente", "ubicacion"]}
    columns={[
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "hora_inicio", label: "H. inicio" },
      { key: "cliente", label: "Cliente" },
      { key: "ubicacion", label: "Ubicación" },
      { key: "tipo_servicio", label: "Tipo", badge: true },
      { key: "num_piezas", label: "Piezas", type: "number" },
      { key: "precio_servicio", label: "Precio", type: "money" },
      { key: "estado", label: "Estado", badge: true },
    ]}
  />
);

// The portal has "Plan de trabajo" and "Registro de Piezas" as separate views
// but they hydrate from the same loncheados table filtered differently.
// Until we know their exact filters, reuse Loncheados + Trazabilidad clones.

export default function SalaCorteRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Panel />} />
        <Route path="plan-trabajo" element={<Loncheados />} />
        <Route path="piezas" element={<Loncheados />} />
        <Route path="loncheados" element={<Loncheados />} />
        <Route path="trazabilidad" element={<Loncheados />} />
        <Route path="salarios" element={<Salarios />} />
        <Route path="rentabilidad" element={<Rentabilidad />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="productos" element={<Productos />} />
        <Route path="empleados" element={<Empleados />} />
        <Route path="servicios" element={<ServiciosCorte />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
    </Routes>
  );
}
