## Iteración 21 (2026-02-14) — FASE 9: Contabilidad analítica (PGC ES simplificado)

- ✅ **15 cuentas del plan contable** auto-sembradas (`accounting_accounts`): 400/430/465/472/476/477 (grupo 4), 570/572 (5), 600/621/628/629/640/642 (6), 700 (7).
- ✅ **`journal_entries`** con `source_ref` único → **idempotencia** garantizada por upsert onInsert. Cada asiento valida `debe == haber` (±0.02 tolerancia).
- ✅ **`POST /api/accounting/backfill`** — escáner que genera asientos desde los documentos fuente:
  - **POS tickets** → (D) 570 caja + 572 tarjeta (según reparto pago) / (H) 700 subtotal + 477 IVA.
  - **Issued invoices** → devengo (D 430 / H 700 + 477) y cobro (D 572 / H 430).
  - **Supplier invoices** → devengo (D 600 + 472 / H 400) y pago (D 400 / H 572).
  - **Salarios pagados** → (D 640 + 642) / (H 465 + 476).
  - **Treasury movements manuales** → (D/H) según `categoria` (venta→700, compra→600, salario→640, gasto/impuestos/otros→629) + contrapartida cuenta caja/banco.
- ✅ **Endpoints de consulta**: `/journal` (filtros from/to/account_code) · `/ledger/{code}` (saldo rodante) · `/vat` (repercutido − soportado = liquidación, con `a_ingresar`/`a_compensar`) · `/pnl` (cuenta de resultados grupo 7 vs 6) · `/analytical` (margen bruto por producto = ventas − qty × `products.average_cost` FIFO) · `/summary`.
- ✅ **Frontend `/admin/contabilidad`** (icono `Calculator`) con 6 pestañas:
  - **Plan contable** — tablas agrupadas por grupo + botón "Regenerar asientos".
  - **Libro diario** — tabla multi-línea con debe/haber por cuenta y filtros.
  - **Libro mayor** — selector de cuenta + saldo rodante + totales debe/haber.
  - **IVA** — 3 cards + fórmula visual + presets Q1..Q4/año.
  - **Cuenta de resultados** — Ingresos/Gastos/Resultado con % margen neto + panels de detalle.
  - **Analítica** — tabla margen por producto con unidades/ventas/coste/margen/%.
- ✅ **Testing agent iter 17**: 9/9 backend pytest PASS + E2E frontend + **idempotencia verificada** (2ª ejecución de backfill = 0 nuevos asientos).
- 🚀 Pusheado a GitHub `main` — commit `558084e`.

---


## Iteración 20 (2026-02-14) — FASE 8: TPV (Punto de venta tienda física) + Distribución (albaranes y rutas)

- ✅ **4 colecciones nuevas** en `routers_distribution.py`:
  - `pos_cash_sessions` — apertura/cierre de caja diaria (numeración `SES-YYYY-NNNNN`), controla una sola sesión abierta a la vez.
  - `pos_tickets` — tickets de venta en tienda (numeración `TCK-YYYY-NNNNN`) con IVA, método pago (efectivo/tarjeta/mixto/bizum), cambio y ligazón a sesión + cuenta.
  - `delivery_notes` — albaranes (`ALB-YYYY-NNNNN`) con estados pendiente / en_ruta / entregado / facturado / incidencia.
  - `delivery_routes` — rutas de reparto (`RUT-YYYY-NNNNN`) que agrupan albaranes.
- ✅ **ENGRANAJES**:
  - **Ticket TPV** → descuenta stock por **FIFO** en todos los items con `product_id` y crea un **movimiento de tesorería (income)** con `reference_type="pos_ticket"` en la cuenta de caja de la sesión activa. Los totales de la sesión se actualizan (`total_ventas`, `num_tickets`).
  - **Cierre de sesión** calcula `saldo_esperado = apertura + total_ventas` y guarda `diferencia = contado - esperado`.
  - **Albarán acción `deliver`** → descuenta stock FIFO por cada línea con `product_id`.
  - **Albarán acción `invoice`** → genera una **factura emitida** (`EMIT-YYYY-NNNNN`) con IVA configurable (10% por defecto) y la enlaza al albarán (`invoice_id`).
  - **Crear ruta** con `delivery_note_ids` → marca esos albaranes como `en_ruta` y guarda su `route_id`.
- ✅ **Frontend `/admin/tpv`** (3 pestañas, sidebar con icono `ShoppingBag`):
  - **Caja (TPV)** — `PosRegister.jsx`: si no hay sesión abierta, muestra empty-state con drawer de apertura (selector de cuenta caja + saldo apertura + empleado). Con sesión abierta: buscador + catálogo de productos (con variantes desglosadas), carrito editable (cantidades, precios y artículos libres), selector IVA (0/4/10/21), payment con 3 métodos, campos efectivo/tarjeta con cálculo de cambio automático, botón "Cobrar" bloqueado si falta importe. Drawer cierre con `saldo_contado` y cálculo de diferencia.
  - **Tickets** — `PosTickets.jsx`: listado buscable con modal detalle que renderiza el ticket completo (items, subtotal, IVA, total y desglose de pago).
  - **Sesiones de caja** — `PosSessions.jsx`: historial completo con badges abierta/cerrada, num_tickets, total_ventas, apertura, cierre y diferencia coloreada.
- ✅ **Frontend `/admin/distribucion`** (2 pestañas, sidebar con icono `Truck`):
  - **Albaranes** — `DeliveryNotes.jsx`: filtro por estado, drawer creación con selector de cliente empresa (autofill desde `business_customers`) o nombre manual, líneas con selector de productos o descripción libre. Modal detalle con acciones dinámicas según estado: `deliver` (verde, descuenta stock), `invoice` (genera factura con IVA seleccionable), `incident` (rojo con motivo), `reset`.
  - **Rutas de reparto** — `DeliveryRoutes.jsx`: cards por ruta con líneas de albaranes agrupados. Drawer con checkboxes de albaranes pendientes.
- ✅ **Testing agent iter 16**: backend 20/20 pytest PASS (`test_iteration16_phase8_pos_dist.py`) + frontend E2E completo con los dos engranajes verificados (ticket → treasury_movement + FIFO; albarán invoice → issued_invoice).
- 🚀 Pusheado a GitHub `main` — commit `fbb1f8f`.

---


## Iteración 19 (2026-02-13) — FASE 7: Tesorería + Facturación emitida (circuito del dinero cerrado)

- ✅ **3 colecciones nuevas** en `routers_treasury.py`:
  - `bank_accounts` (cuentas bancarias + cajas físicas) con **saldo calculado en vivo** desde los movimientos.
  - `treasury_movements` (todos los cobros/pagos, con account_id + reference_type/id para trazabilidad).
  - `issued_invoices` (facturas emitidas manuales/B2B con estados issued/sent/paid/overdue/cancelled, numeración `EMIT-YYYY-NNNNN`).
- ✅ **Engranajes del dinero**:
  - `POST /api/issued-invoices/{id}/mark-paid` — cobra factura + crea movimiento entrada + sube saldo.
  - `POST /api/treasury/pay-supplier-invoice/{id}` — paga factura proveedor + crea movimiento salida + baja saldo.
- ✅ **Cash flow forecast**: `GET /api/treasury/cashflow?days=N` con saldo_actual, por_cobrar, por_pagar, vencidos, saldo_proyectado.
- ✅ **Recordatorios**: `GET /api/treasury/reminders` separa vencidas y próximas 7 días para cobrar y pagar.
- ✅ **Frontend `/admin/tesoreria`** con 5 pestañas (icono Wallet):
  - Cash flow con toggles 7/30/60/90 días.
  - Cuentas y caja (cards con saldo en vivo).
  - Movimientos con filtros (cuenta, tipo).
  - Facturas emitidas con Cliente empresa autofill desde business_customers.
  - Recordatorios con botones inline "Cobrar/Pagar".
- ✅ **Shared PayModal**: componente reutilizable (exportado desde `IssuedInvoices.jsx`) usado también por `SupplierInvoices.jsx` (Fase 6) para que el botón "Marcar pagada" abra el mismo modal con selector de cuenta y disparo del movimiento.
- ✅ **Testing agent iter 15**: backend 19/19 pytest + frontend 100% con ambos engranajes verificados extremo a extremo.
- 🚀 Pusheado a GitHub `main` — commit `c5d204f`.




- ✅ **5 colecciones nuevas** con CRUD (`routers_inventory.py`):
  - `warehouse_locations` · `stock_lots` · `purchase_orders` · `goods_receipts` · `supplier_invoices`.
- ✅ **ENGRANAJE 1**: `POST /api/stock-alerts/{id}/convert-to-po` — convierte una alerta aprobada/enviada en pedido de compra (`PO-YYYY-NNNNN`), guarda `source_alert_id`. Botón "Convertir en pedido a proveedor" en el drawer de alertas.
- ✅ **ENGRANAJE 2**: `POST /api/goods-receipts` — al recepcionar mercancía:
  - Crea un **lote** por línea (con `expires_at`, `location_id`, `LOT-YYYY-NNNNN`).
  - Incrementa `products.stock`.
  - **Recalcula `average_cost` con la fórmula ponderada** `((old_stock*old_avg)+(new_qty*new_cost))/new_stock` y guarda `last_cost`.
  - **Genera automáticamente una factura de proveedor** en estado `pending_payment` con 10% IVA (`FAC-YYYY-NNNNN`).
  - Si viene de un PO, lo marca como `received`.
- ✅ **ENGRANAJE 3**: al crear un loncheado con `producto_inventario_id`, se llama a `_consume_fifo` (helper interno importado por routers_erp_production):
  - FIFO por `expires_at` asc, luego `received_at` asc.
  - Decrementa lotes coincidentes, recalcula `products.stock`, registra `stock_movements` con `lots_affected`.
  - El `coste` real se autocalcula sumando `qty*unit_cost` de los lotes consumidos.
- ✅ **Frontend `/admin/inventario`** con 6 pestañas:
  - Valoración stock (con total + tabla por producto).
  - Lotes (con toggle "caducan en 30 días" y coloreado rojo/ámbar).
  - Ubicaciones (CRUD: almacén, cámara frigorífica, sala loncheado, tienda).
  - Pedidos a proveedores (expansibles, badges "Alerta stock").
  - Recepciones (drawer con "Desde pedido pendiente", líneas editables, `Generar factura` toggle).
  - Facturas proveedor (4-card summary + status filter + botón "Marcar pagada").
- ✅ **UI de los engranajes**:
  - Botón "Convertir en pedido a proveedor" en drawer de alertas.
  - Sección "🔗 Enlazar a producto del inventario" en drawer de loncheados con hint ámbar del qty a consumir, y toast de resultado (success o warning con `unmet`).
- ✅ **Testing agent iter 14**: backend 21/21 pytest, frontend 100% tras fix 1-line en `SlicingDrawer` (falta `inventoryProducts` en destructure).
- 🚀 Pusheado a GitHub `main` — commit `f188300`.




- ✅ **Migración masiva desde Supabase** (portal histórico `lasdosdoncellasapp.es`):
  - Endpoint `GET /api/erp/sync/preview` lee conteos vía PostgREST con `service_role`.
  - Endpoint `POST /api/erp/sync/run` upsert por UUID original → **idempotente**, no duplica.
  - Variables env: `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` en `/app/backend/.env`.
  - **Importado**: 4 empleados, 11 clientes producción, 8 productos/tipos, 800 loncheados, 800 salarios, 10 eventos, 3 etiquetas → **1.636 registros**.
- ✅ **7 colecciones nuevas** con CRUD completo en `routers_erp_production.py`:
  `production_employees` · `production_clients` · `production_products` · `production_slicings` · `production_salaries` · `production_events` · `production_labels`.
- ✅ **Aggregations**:
  - `GET /api/erp/slicings/summary` → piezas, kg loncheados, kg brutos, ingresos, coste, beneficio, merma_kg, merma_pct, media €/kg.
  - `GET /api/erp/salaries/monthly?year=YYYY&month=MM` → rows agrupados por empleado + total.
- ✅ **Frontend ERP** (`/admin/erp`) con sub-rutas y sidebar dedicado (Factory icon):
  - **Loncheados**: 6 KPIs (800 piezas / 6.630 kg / 233.120,90 € ingresos / 35,16 €/kg medio) + tabla con filtros (cliente, empleado, fechas, búsqueda) + drawer con merma y rendimiento calculados en vivo.
  - **Empleados**: CRUD con campos enriquecidos (salario base, €/kg normal, €/kg emplatado, notas).
  - **Salarios**: vista mensual con prev/next/Hoy. Junio 2026: Jesús Palomo 2.245 €, Mario Bernal 1.370 €, total 3.615 €.
  - **Clientes producción**: minoristas/mayoristas/particulares con 3 tarifas (€/kg menor, mayor, emplatado).
  - **Tipos de pieza**: catálogo con coste €/kg y rendimiento esperado.
  - **Eventos/Servicios**: calendario de cortes con estados PROGRAMADO/CONFIRMADO/COMPLETADO/CANCELADO y filtros.
  - **Etiquetas particulares**: grid de etiquetas de envío.
  - **Importar desde Supabase**: tabla de preview con conteos y botón "Sincronizar ahora" idempotente.
- ✅ **Testing agent iter 13**: 100% backend (23/23 pytest) + 100% frontend. Suite en `/app/backend/tests/test_iteration13_erp_phase5.py`.
- ⚠️ **Limitación documentada**: los 800 loncheados importados tienen `peso_bruto=0` (Supabase legacy no lo guardaba), así que COSTE/BENEFICIO/MERMA muestran 0 hasta que se introduzca el peso de entrada en nuevos registros.
- 🚀 Pusheado a GitHub `main` — commit `aa0816e`.




- ✅ **Detección automática de stock bajo** agrupada por proveedor:
  - Endpoint `GET /api/stock-alerts/scan` — preview en vivo sin persistir.
  - Endpoint `POST /api/stock-alerts/generate` — crea borradores en `db.stock_alerts` con estado `pending_approval`. **Idempotente**: si ya hay un borrador pendiente para ese proveedor, se actualiza.
  - Cantidad sugerida = `max(threshold*2 − current_stock, 1)`. Precio unitario = `cost_price || price`.
- ✅ **Workflow de aprobación**:
  - `PATCH /api/stock-alerts/{id}` — solo permite editar borradores `pending_approval` (ítems, cantidades, precios, notas).
  - `POST /api/stock-alerts/{id}/approve` — **EXIGE `is_superadmin = true`**. Asigna número secuencial anual `PRO-{YYYY}-NNNNN`, genera el PDF y envía email al proveedor con la proforma adjunta (Brevo). Si el email falla, el estado queda en `approved` (visible en su pestaña dedicada) y el superadmin puede descargar y reenviar manualmente.
  - `POST /api/stock-alerts/{id}/reject` — **superadmin only**. Pide motivo (no vacío), estado pasa a `rejected`.
- ✅ **Nuevo PDF de proforma** (`proforma_pdf.py`): A4 con cabecera de marca, bloque del proveedor, tabla SKU/stock/umbral/cantidad/precio/subtotal, total y notas.
- ✅ **Email al proveedor** (`email_service.send_proforma_to_provider`): adjunta el PDF en base64 (Brevo). Falla limpiamente en dev (BREVO_API_KEY vacío).
- ✅ **Nuevos permisos**: `stock.read`, `stock.write`, `stock.approve`.
- ✅ **Frontend CMS**: nueva pestaña `/admin/stock-alerts` (icono `AlertTriangle`):
  - Botones "Escanear stock bajo" + "Generar borradores".
  - 4 tabs por estado (Pendientes · Aprobados sin envío · Enviados · Rechazados).
  - Drawer con tabla editable, recálculo de total en vivo, notas, descarga de PDF, botones "Aprobar y enviar" / "Rechazar con motivo" **visibles solo para superadmin** (resto ve aviso ámbar explicativo).
- ✅ **Testing agent iter 12**: 100% backend (25/25 pytest) + 100% frontend en todos los flujos pedidos. Suite en `/app/backend/tests/test_iteration12_stock_alerts.py`.
- 🚀 Pushed a GitHub `main`.




- ✅ **Usuarios Empresa (B2B)** — nueva pestaña CMS `/admin/empresas`:
  - Backend: `routers_business_customers.py` con CRUD completo, colección `db.business_customers` con índices únicos en `email` y `tax_id`.
  - Modelo: razón social, CIF/NIF, persona de contacto, email, teléfono, dirección fiscal completa, **descuento personalizado %** (0–100, validado), **condiciones de pago** (Contado/15/30/60/90 días), **límite de crédito €** (>=0), notas internas, tags, activo/inactivo.
  - Frontend: `BusinessUsers.jsx` con tabla + drawer en 4 bloques (datos fiscales · dirección · condiciones comerciales · notas).
  - Permisos: reutiliza `customers.read/write/delete` (no se añade ningún scope nuevo).
  - Sidebar: nuevo enlace con icono `Building2`, visible para quien tenga `customers.read`.
- ✅ **Modales relacionales en CMS** — nuevo componente `components/admin/RelationModal.jsx` reutilizable (tipos: `web-customer`, `business-customer`, `provider`, `product`):
  - **Productos → Proveedor**: el nombre del proveedor en la columna `Proveedor` es un botón que abre la ficha del proveedor sin salir de la pantalla.
  - **Pedidos → Cliente**: el email del cliente en la fila del pedido (y un botón "Ver ficha de cliente →" dentro del drawer) abre la ficha del cliente web si está registrado. Si fue un checkout invitado, muestra toast "Pedido de invitado". Endpoint nuevo `GET /api/users/web/by-email/{email}` con regex case-insensitive escapada.
  - z-index 60 (drawer existente usa 50) para que el modal flote por encima.
- ✅ **Testing agent iter 11**: 100% backend (20/20 pytest), frontend OK tras 1 import faltante (`RelationModal` en Products.jsx — corregido). Suite reutilizable en `/app/backend/tests/test_iteration11_phase3.py`.
- 🚀 Pushed a GitHub `main`.



- ✅ **Sistema genérico de variantes** (cualquier producto, mismo SKU base, varios formatos con precio independiente):
  - Backend: `ProductVariant {label, price, compare_at_price?, stock?, sku_suffix?, attributes?}` + `ProductIn.variants[]`
  - CMS: nuevo `VariantsEditor.jsx` con tabla compact (add/remove rows)
  - Storefront: selector de variantes en detalle de producto (chips clicables) + precio se actualiza en vivo
- ✅ **Atributos específicos por categoría**:
  - Jamones/Paletillas: peso (7-8/8-9/9-10kg), tipo de corte (pieza/a-mano/deshuesado), punto de curación (tierno/punto/intenso)
  - Quesos: peso, D.O. libre, origen de leche (Cabra/Oveja/Vaca/Mezcla), tipo de leche (Cruda/Pasteurizada/Sin lactosa)
  - Embutidos: format (pieza-entera/media-pieza)
  - Vinos / Vino Granel / Bebidas Alcohólicas: pairing_text + multi-select de quesos del catálogo
  - Componente `CategoryAttributes.jsx` dinámico según slug
- ✅ **Productos relacionados** abajo del detalle (`GET /api/products/{id}/related?limit=6`, misma categoría primero, completa con recientes, excluye self)
- ✅ **Maridaje vino → quesos** (`GET /api/products/{id}/pairing-cheeses` lookup por `attributes.paired_cheese_ids`). Sección "Marida bien con estos quesos" en detalle del vino con tarjetas + texto opcional
- ✅ **Filtros avanzados en /catalogo?categoria=quesos**: 3 selects (D.O., Leche, Tipo) + Limpiar filtros. URL params do/milk_origin/milk_type
- ✅ **Polish**: placeholder elegante en ProductCard cuando no hay imagen (gradiente + "Próximamente")
- ✅ **Testing agent iter 10**: 100% pass — backend 5/5 pytest + frontend flows críticos (click variante cambia precio 4,50→8,50€ en vivo verificado)
- 🚀 Pusheados a GitHub `main` — commits `591504b` + `909cb05`


## Iteración 13 (2026-02-13) — FASE 1: UI más densa + WhatsApp + 16 categorías
- ✅ **UI sizing más densa**:
  - CategoryTiles en home → 4 cols desktop (lg:grid-cols-4), 16 tiles en 4 filas de 4
  - FeaturedProducts + MiniCategorySection + Catalog → 6 cols XL (xl:grid-cols-6)
  - MiniCategorySection muestra ahora hasta 6 productos (antes 4)
- ✅ **16 categorías definitivas migradas**:
  - Jamones, Paletillas, Quesos, Loncheados, Embutidos, Cortes, Aceites, Conservas, Aceitunas, Miel, Sal, Bebidas, Vinos, Vino Granel, Bebidas Alcohólicas (age_restricted), Varios
  - Migración automática: renombra legacy 'Vinos & Generosos' → 'Vinos', actualiza positions, marca como `is_active=false` cualquier slug fuera de la lista definitiva (la legacy 'lotes' queda oculta sin perder productos)
- ✅ **Chat reemplazado por Configuración** en CMS sidebar (icono Settings)
  - Nueva página `/admin/configuracion` con form WhatsApp: enabled, phone, label, default_message + preview wa.me
  - Backend nuevo `routers_settings.py` singleton: `GET /api/settings/public` (storefront, sin auth) y `GET/PUT /api/settings` (admin)
- ✅ **Botón flotante WhatsApp** en storefront:
  - Pill verde con icono SVG inline + animate-ping
  - Solo aparece si `whatsapp.enabled` + `phone` están configurados
  - Oculto en `/admin/*`
- ✅ **Testing agent**: 9/9 pytest backend + 100% frontend en iter 9. Tests endurecidos persisten: `test_exactly_16_active_categories`, `test_legacy_lotes_is_inactive`.
- 🚀 Pusheados a GitHub `main` — commits `f0901e6` + `aa29ab3`

## Próximas fases pendientes (acordadas con el usuario)
- **Fase 2**: variantes genéricas por producto (peso/formato con su propio precio) + campos específicos por categoría (jamones: peso/corte/curación; quesos: DO/leche; embutidos: pieza/media; vinos: maridaje con quesos) + productos relacionados en detalle.
- **Fase 3**: CMS Usuarios Empresa (B2B) + modales de relación entre tablas.
- **Fase 4**: avisos de stock + factura proforma + email al proveedor.


## Iteración 12 (2026-02-13) — Mobile crop + Animaciones + Freshness Badge
- ✅ **BUG móvil P0 resuelto**: tarjetas de "Explora por categoría" se cortaban en columna derecha en móvil. Fix: padding responsive `p-3 sm:p-6 md:p-8`, texto `text-lg sm:text-2xl md:get-4xl`, aspect `[4/5] sm:[3/4]`, gap `3 sm:6 lg:8`. Verificado en 320/375/390px: overflow_right=-13px (siempre 13px INSIDE) para los 6 tiles, incluyendo "Vinos & Generosos", "Aceites & Conservas", "Lotes Selectos".
- ✅ **Animaciones elegantes nuevas** (todas respetan `prefers-reduced-motion`):
  - `.ldd-tile` — entrada con stagger + hover-lift (translateY -4px) + sombra dorada
  - `.ldd-btn-gold::before` — shimmer dorado que cruza el botón al hover
  - `.ldd-btn-ghost::after` — halo dorado expansivo al hover
  - `.reveal` + hook `useReveal` (IntersectionObserver) — fade-up al entrar en viewport
  - `.ldd-heading-line` — underline animado debajo de títulos al revealar
  - `.icon-floating` — flotación sutil 6s en iconos de proceso
  - `.hero-zoom` — zoom infinito 24s ease-in-out alternate en hero
- ✅ **Badge "Última actualización" en CMS**:
  - Endpoint `GET /api/admin/freshness` (require_permission dashboard.read) devuelve `{latest_change_at, by_entity, now}`
  - Componente `FreshnessBadge` en sidebar — texto "Sincronizado · hace X min" con punto verde animado (animate-ping), refresca cada 60s + ticker 30s
  - Resuelve la fricción "se ve bien en preview pero en producción aún no" confirmando visualmente la sincronización
- ✅ **Testing agent**: 100% pass (11/11 checks) — pytest backend + mobile crop 3 viewports + animaciones + regresiones
- 🚀 Pusheado a GitHub `main` — commit `24d0735`


## Iteración 11 (2026-02-13) — Producción: auto-seed y forzar seed
- ✅ **Root cause del bug reportado por el usuario** ('en la web no aparece Explora por categoría'): la BD de Render aún no tenía las categorías Quesos/Vinos/Aceites porque el auto-seed sólo corría si la BD estaba completamente vacía. Tras el deploy nuevo, el código pintaba tarjetas usando categorías inexistentes en la BD → CategoryTiles renderizaba null.
- ✅ **server.py startup**: ahora también re-ejecuta el seed si faltan las categorías clave (quesos, vinos, aceites). Migración automática de `position` e `is_active` en categorías legacy. Todo idempotente por SKU.
- ✅ **seed_products.py**: `_ensure_categories` actualiza categorías existentes con position/is_active si están a null. Migración extra al final del seed aplica `DEFAULT_IMAGES` a productos sin foto.
- ✅ **Nuevo endpoint** `POST /api/seed/demo` (admin) — devuelve `{ok, products_added, categories_added, total_products, total_categories}`. NUNCA borra datos.
- ✅ **Nuevo botón "Forzar seed demo"** en CMS Categorías con icono Sparkles + confirm + toast.
- ✅ **Testing agent**: 100% pass (4/4 backend + frontend regressions verde). Confirmada idempotencia y que NO se borran datos. Tests creados en `/app/backend/tests/test_iteration5_seed.py`.
- ✅ **Cleanup**: renombrada función legacy `force_seed_demo` → `force_seed_demo_legacy` para evitar shadow (action item del testing agent).
- 🚀 Pusheado a GitHub `main` — commits `66a8a41` + `9463fd0`. Cuando Render redeploy automático, las demos aparecerán automáticamente en producción.


## Iteración 10 (2026-02-13) — Fix móvil + UX navegación
- ✅ **2 columnas de productos en móvil** (antes 1 sola columna):
  - `Catalog.jsx` grid → `grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
  - `Storefront.jsx` FeaturedProducts + MiniCategorySection → `grid grid-cols-2 lg:grid-cols-4`
  - `Storefront.jsx` CategoryTiles → `grid-cols-2 md:grid-cols-3` (antes 1 col en móvil)
  - Gap reducido a `gap-x-4 sm:gap-x-8` para que las tarjetas no queden estrechas
- ✅ **Scroll-to-top global** — nuevo componente `ScrollToTop.jsx` montado en `App.js`. Escucha cambios de `pathname` + `search` y hace `window.scrollTo(0)` instantáneo. Resuelve "aterrizo en mitad del catálogo" al pulsar una tarjeta desde el home/catbar.
- ✅ **Scroll-to-top adicional en Catalog** al cambiar el chip de categoría dentro del propio catálogo.
- ✅ **Testing agent verificó 11/11 checks** — viewport 390x844 y 1366x900: tarjetas en 2 cols mobile / 3-4 cols desktop, scrollY=0 después de click, login cliente OK, CMS categorías OK.
- 🚀 Pusheado a GitHub `main` — commit `2b038f4`.


## Iteración 9 (2026-02-13)
- ✅ **CRUD completo de categorías desde el CMS** — nueva pestaña `/admin/categories`:
  - Tabla con conteo de productos, posición, estado (activa/oculta), botones subir/bajar orden
  - Modal de edición con: nombre, slug (auto-generado al teclear), descripción, posición, toggle activo, subida de imagen (Cloudinary)
  - Crear / Editar / Eliminar (al borrar, los productos quedan sin categoría — no se eliminan)
- ✅ **Backend ampliado**:
  - `POST /api/categories/{id}/image` — sube imagen a Cloudinary y guarda `image_url` en BD
  - `PATCH /api/categories/{id}` — edición de cualquier campo (incluye slug con validación de unicidad)
  - `GET /api/categories/{id}` — lookup por id o slug
  - `DELETE` ahora desvincula productos (no los borra)
  - `CategoryIn` ahora soporta `image_url`, `position`, `is_active`
- ✅ **Home dinámico** — `Explora por categoría` y mini-secciones se generan automáticamente desde `/api/categories` (filtradas por `is_active` y ordenadas por `position`). Cada cambio en el CMS se refleja en el storefront sin tocar código.
- ✅ **Mensaje elegante "Próximamente"** en el catálogo cuando una categoría no tiene productos. Incluye eyebrow con nombre de la categoría, título grande "Próximamente", copy contextual y CTA "Ver todo el catálogo".
- ✅ **`/categoria/:slug` redirige a `/catalogo?categoria=:slug`** — una sola UX para navegar por categoría.
- ✅ **Categorías legacy normalizadas** — `position` e `is_active` aplicados automáticamente a las que tenían valores nulos.
- 🚀 Pusheado a GitHub `main` — commit `d4c87ea`.


## Iteración 8 (2026-02-13)
- ✅ **Catálogo navegable por categorías** — pestañas Todos / Jamones / Embutidos / Quesos / Vinos & Generosos / Aceites & Conservas / Lotes Selectos, con conteo por categoría y filtro persistente en URL (`?categoria=slug`). Botón "Limpiar filtro" + título dinámico ("Catálogo" → "Quesos" cuando hay filtro).
- ✅ **Home con productos desde el minuto 1** — 5 nuevas mini-secciones bajo "Explora por categoría":
  - 🍖 **Los mejores jamones** (alineado izquierda)
  - 🍇 **Embutidos artesanos** (alineado derecha)
  - 🧀 **Los mejores quesos**
  - 🍷 **Vinos de la sierra** (alineado derecha)
  - 🫒 **Aceites y conservas**
  Cada sección muestra hasta 4 productos reales de la categoría con CTA al catálogo filtrado.
- ✅ **18 productos demo nuevos** inyectados vía `seed_products.py`:
  - Quesos (6): Oveja Curado/Semicurado, Cabra al Romero, Azul de Cabra, Payoyo Viejo, Torta del Casar
  - Vinos & Generosos (6): Tinto Crianza, Verdejo, Fino Andaluz, Reserva Familiar, PX Dulce, Cava Brut
  - Aceites & Conservas (6): AOVE Picual, Hojiblanca, Coupage, Trufado, Vinagre Jerez, Miel de la Sierra
  - Todos con imagen por defecto (Unsplash) — listos para que el cliente reemplace por la suya en el CMS.
- ✅ **"Mi perfil" del dropdown** ahora abre `/cuenta?tab=profile` (panel "Mi Cuenta" con pestaña **Mis datos** activa).
- ✅ **Dirección fiscal actualizada** a `Plaza Amarilla, 3` en StoreFooter, AboutUs, `company_info.py` (facturas/emails), `public/index.html` (schema.org JSON-LD) y `DEPLOY_GUIDE.md`.
- ✅ **CategoriesBar dinámica** — ahora se llena desde `/api/categories` (antes hardcoded). Si el cliente añade categorías nuevas en CMS, aparecen automáticamente.
- 🚀 Pusheado a GitHub `main` — commit `7134c4d`.


## Iteración 7 (2026-02-13)
- ✅ **Fix P0 — Login del cliente parpadeaba sin entrar**:
  - **Causa**: split-brain entre el sistema unificado de auth (`/api/auth/*` sobre `db.users`) y el legacy (`/api/customer/*` sobre `db.customers`). El fix anterior (392c637) cambió `CustomerContext.refresh()` a `/api/customer/me`, pero login seguía en `/api/auth/login` (token `type=access`). `/api/customer/me` exigía `type=customer` y leía de `db.customers` → 401 → flicker → no entraba.
  - **Backend**: `get_current_customer` (en `routers_customers.py`) ahora acepta los DOS flujos — preferencia por Bearer, normaliza `name` a partir de `first_name`/`last_name`, rechaza superadmin.
  - **Frontend**: `CustomerContext` con `withCredentials:false` (evita filtración de cookies del admin), filtra `is_superadmin`/`role!=customer` y vuelve a `/api/auth/me` en `refresh()`. `CustomerLogin` deja de hacer `window.location.replace + refresh` redundante (era el causante del parpadeo) y navega via react-router.
- ✅ **Home — Opción C (rediseño elegante)**:
  - Sección "Explora **por categoría**" — 3 tiles visuales (Jamones / Embutidos / Lotes & Regalos) con overlay degradado y hover (zoom + CTA).
  - "Stats strip" con métricas (+30 productos · 48m curado · 100% bellota · 24h envíos).
  - "Tres pasos. **Mucho tiempo.**" — proceso artesanal (Bellota & dehesa · Curado lento · Sabor de Castilblanco) con iconos lucide.
  - Sección "Voces de la mesa" con testimoniales reales desde `/api/reviews/recent` (público).
  - CTA final "Lleva la **Sierra Norte** a tu mesa" con fondo blurred + envíos 24-48h.
- ✅ **Nuevo endpoint público** `GET /api/reviews/recent?limit&min_rating` — devuelve reseñas aprobadas enriquecidas con `product_name`.
- 🚀 Pusheado a GitHub `main` — commit `69e072e`.


## Iteración 5 (2026-02-13)
- ✅ **Sistema de reseñas 5★** completo (backend `/api/reviews` + UI):
  - Modelo en `routers_reviews.py` — una reseña por cliente/producto (edita si reseña otra vez)
  - Productos incluyen `avg_rating` y `review_count` calculados al insertar/borrar
  - Componente `StarRating` reutilizable (display + input con hover) en `/components/StarRating.jsx`
  - `ReviewsSection` en `ProductDetail` con resumen, distribución por estrellas, formulario y lista
  - `ProductCard` muestra estrellas + número de reseñas cuando hay
- ✅ **Dashboard ampliado**: contador de reseñas, media global, top productos por valoración y últimas reseñas recientes
- ✅ **Fix CMS lento en móvil**: el widget de Google Translate ya no se carga en `/admin`. Componente `GoogleTranslateLoader` que solo se monta cuando la ruta NO empieza por `/admin` (ahorra ~200KB de JS + DOM-walk en el panel)
- ✅ **Banderas en selector de idioma**: emojis 🇪🇸🇬🇧🇫🇷🇵🇹🇩🇪🇮🇹, bandera del idioma activo en el botón principal
- 🚀 Pusheado a GitHub `main` — commit `a112a9b`


## Iteración 4 (2026-02-13)
- ✅ Páginas legales con texto literal de la web actual:
  - `/legal/aviso-legal`
  - `/legal/politica-privacidad`
  - `/legal/politica-cookies`
- ✅ Nueva columna **LEGAL** en `StoreFooter` con enlaces a las 3 páginas.
- ✅ Fix CMS productos: el upload de imagen ahora propaga `images/image_urls` al padre y se hace un `load()` al cerrar el drawer para resincronizar con servidor. Bug `data.storage_path` undefined corregido.
- ✅ Chat interno: cuando un cliente envía un mensaje se notifica por email a `info@lasdosdoncellasibericos.es` vía Brevo. Cooldown anti-spam de 15 minutos por cliente (configurable con env `CHAT_NOTIFICATION_EMAIL`).
- 🚀 Pusheado a GitHub `main` — commit `9d8c26f`.


# Las Dos Doncellas — PRD (iter 3)

## Iteración 3 (2026-02-12)
- ✅ Import/Export Excel genérico para TODAS las pestañas CMS (productos, proveedores, categorías, usuarios, clientes, pedidos).
- ✅ Componente reutilizable `ExcelBar` (Plantilla / Exportar / Importar) en cada listado del CMS.
- ✅ Branding Emergent eliminado: index.html limpio, badge "Made with Emergent" eliminado, PostHog tracking eliminado, title "Las Dos Doncellas".
- ✅ SEO: robots.txt + sitemap.xml + meta tags + Structured Data (FoodEstablishment schema).
- ✅ Proyecto comprimido: `/app/frontend/public/downloads/lasdosdoncellas-app.zip` (372 KB sin node_modules).
- ✅ Guía de despliegue paso a paso: `/app/DEPLOY_GUIDE.md` (MongoDB Atlas + Render + LucusHost + Brevo + Stripe live).

Endpoints Excel nuevos:
- GET/POST /api/excel/products/template|export|import
- GET/POST /api/excel/providers/template|export|import
- GET/POST /api/excel/categories/template|export|import
- GET/POST /api/excel/users/template|export|import
- GET/POST /api/excel/customers/template|export
- GET/POST /api/excel/orders/template|export|import (iter 2)

## Próximos pasos sugeridos
- Importar productos reales desde el SQL pcscale (pasarme INSERT INTO `Items` cuando lo tengas).
- Stripe saved cards + "Comprar ya" off-session (próxima iter).
- Google OAuth (necesita Google Cloud credentials).
- Brevo API key + verificación dominio.
