import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";
import { CustomerProvider } from "@/context/CustomerContext";
import { CartProvider } from "@/context/CartContext";
import GoogleTranslateLoader from "@/components/GoogleTranslateLoader";
import ScrollToTop from "@/components/ScrollToTop";
import WhatsAppFloat from "@/components/storefront/WhatsAppFloat";

import Storefront from "@/pages/Storefront";
import Catalog from "@/pages/Catalog";
import CategoryPage from "@/pages/CategoryPage";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import LotConfigurator from "@/pages/LotConfigurator";
import AboutUs from "@/pages/AboutUs";

import CustomerLogin from "@/pages/CustomerLogin";
import CustomerRegister from "@/pages/CustomerRegister";
import CustomerAccount from "@/pages/CustomerAccount";
import Profile from "@/pages/Profile";
import Orders from "@/pages/Orders";
import Settings from "@/pages/Settings";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import ExecutiveDashboard from "@/pages/admin/ExecutiveDashboard";
import ProductsAdmin from "@/pages/admin/Products";
import CategoriesAdmin from "@/pages/admin/Categories";
import OrdersAdmin from "@/pages/admin/Orders";
import UsersAdmin from "@/pages/admin/Users";
import BusinessUsersAdmin from "@/pages/admin/BusinessUsers";
import StockAlertsAdmin from "@/pages/admin/StockAlerts";
import ErpLayout from "@/pages/admin/erp/ErpLayout";
import ErpSync from "@/pages/admin/erp/ErpSync";
import ErpAnalytics from "@/pages/admin/erp/ErpAnalytics";
import ErpSlicings from "@/pages/admin/erp/ErpSlicings";
import ErpEmployees from "@/pages/admin/erp/ErpEmployees";
import ErpSalaries from "@/pages/admin/erp/ErpSalaries";
import ErpClients from "@/pages/admin/erp/ErpClients";
import ErpProdProducts from "@/pages/admin/erp/ErpProdProducts";
import ErpEvents from "@/pages/admin/erp/ErpEvents";
import ErpLabels from "@/pages/admin/erp/ErpLabels";
import ContaSimpleSync from "@/pages/admin/ContaSimpleSync";
import DashboardGeneral from "@/pages/admin/portal/DashboardGeneral";
import SalaCorteRouter from "@/pages/admin/portal/SalaCorte";
import TiendaRouter from "@/pages/admin/portal/Tienda";
import DistribucionRouter from "@/pages/admin/portal/Distribucion";
import FinanzasRouter from "@/pages/admin/portal/Finanzas";
import { CalendarioEventos, IaEmpresarial } from "@/pages/admin/portal/CalendarioIA";
import InventoryLayout from "@/pages/admin/inventory/InventoryLayout";
import InventoryValuation from "@/pages/admin/inventory/InventoryValuation";
import InventoryLots from "@/pages/admin/inventory/InventoryLots";
import InventoryLocations from "@/pages/admin/inventory/InventoryLocations";
import PurchaseOrders from "@/pages/admin/inventory/PurchaseOrders";
import GoodsReceipts from "@/pages/admin/inventory/GoodsReceipts";
import SupplierInvoices from "@/pages/admin/inventory/SupplierInvoices";
import TreasuryLayout from "@/pages/admin/treasury/TreasuryLayout";
import Cashflow from "@/pages/admin/treasury/Cashflow";
import Accounts from "@/pages/admin/treasury/Accounts";
import Movements from "@/pages/admin/treasury/Movements";
import IssuedInvoices from "@/pages/admin/treasury/IssuedInvoices";
import Reminders from "@/pages/admin/treasury/Reminders";
import PosLayout from "@/pages/admin/pos/PosLayout";
import PosRegister from "@/pages/admin/pos/PosRegister";
import PosTickets from "@/pages/admin/pos/PosTickets";
import PosSessions from "@/pages/admin/pos/PosSessions";
import DistributionLayout from "@/pages/admin/distribution/DistributionLayout";
import DeliveryNotes from "@/pages/admin/distribution/DeliveryNotes";
import DeliveryRoutes from "@/pages/admin/distribution/DeliveryRoutes";
import AccountingLayout from "@/pages/admin/accounting/AccountingLayout";
import ChartOfAccounts from "@/pages/admin/accounting/ChartOfAccounts";
import Journal from "@/pages/admin/accounting/Journal";
import Ledger from "@/pages/admin/accounting/Ledger";
import VatReport from "@/pages/admin/accounting/VatReport";
import PnL from "@/pages/admin/accounting/PnL";
import Analytical from "@/pages/admin/accounting/Analytical";
import ProvidersAdmin from "@/pages/admin/Providers";
import Configuracion from "@/pages/admin/Configuracion";

import AvisoLegal from "@/pages/legal/AvisoLegal";
import PoliticaPrivacidad from "@/pages/legal/PoliticaPrivacidad";
import PoliticaCookies from "@/pages/legal/PoliticaCookies";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CustomerProvider>
          <CartProvider>
            <Toaster position="top-right" richColors theme="dark" />
            <GoogleTranslateLoader />
            <ScrollToTop />
            <WhatsAppFloat />
            <Routes>
              <Route path="/" element={<Storefront />} />
              <Route path="/catalogo" element={<Catalog />} />
              <Route path="/categoria/:slug" element={<CategoryPage />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/lotes/configurador" element={<LotConfigurator />} />
              <Route path="/nosotros" element={<AboutUs />} />
              <Route path="/cart" element={<Checkout />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout/success" element={<CheckoutSuccess />} />

              <Route path="/cuenta/login" element={<CustomerLogin />} />
              <Route path="/cuenta/registro" element={<CustomerRegister />} />
              <Route path="/cuenta/olvide-password" element={<ForgotPassword />} />
              <Route path="/cuenta/restablecer" element={<ResetPassword />} />
              <Route path="/cuenta" element={<CustomerAccount />} />
              <Route path="/cuenta/perfil" element={<Profile />} />
              <Route path="/cuenta/pedidos" element={<Orders />} />
              <Route path="/cuenta/configuracion" element={<Settings />} />

              <Route path="/legal/aviso-legal" element={<AvisoLegal />} />
              <Route path="/legal/politica-privacidad" element={<PoliticaPrivacidad />} />
              <Route path="/legal/politica-cookies" element={<PoliticaCookies />} />

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<ExecutiveDashboard />} />
                <Route path="ecommerce" element={<Dashboard />} />
                <Route path="products" element={<ProductsAdmin />} />
                <Route path="categories" element={<CategoriesAdmin />} />
                <Route path="orders" element={<OrdersAdmin />} />
                <Route path="providers" element={<ProvidersAdmin />} />
                <Route path="users" element={<UsersAdmin />} />
                <Route path="empresas" element={<BusinessUsersAdmin />} />
                <Route path="stock-alerts" element={<StockAlertsAdmin />} />
                <Route path="erp" element={<ErpLayout />}>
                  <Route index element={<ErpAnalytics />} />
                  <Route path="panel" element={<ErpAnalytics />} />
                  <Route path="loncheados" element={<ErpSlicings />} />
                  <Route path="empleados" element={<ErpEmployees />} />
                  <Route path="salarios" element={<ErpSalaries />} />
                  <Route path="clientes" element={<ErpClients />} />
                  <Route path="productos" element={<ErpProdProducts />} />
                  <Route path="eventos" element={<ErpEvents />} />
                  <Route path="etiquetas" element={<ErpLabels />} />
                  <Route path="sync" element={<ErpSync />} />
                </Route>
                <Route path="inventario" element={<InventoryLayout />}>
                  <Route path="valoracion" element={<InventoryValuation />} />
                  <Route path="lotes" element={<InventoryLots />} />
                  <Route path="ubicaciones" element={<InventoryLocations />} />
                  <Route path="pedidos" element={<PurchaseOrders />} />
                  <Route path="recepciones" element={<GoodsReceipts />} />
                  <Route path="facturas-proveedor" element={<SupplierInvoices />} />
                </Route>
                <Route path="tesoreria" element={<TreasuryLayout />}>
                  <Route path="cashflow" element={<Cashflow />} />
                  <Route path="cuentas" element={<Accounts />} />
                  <Route path="movimientos" element={<Movements />} />
                  <Route path="facturas-emitidas" element={<IssuedInvoices />} />
                  <Route path="recordatorios" element={<Reminders />} />
                </Route>
                <Route path="tpv" element={<PosLayout />}>
                  <Route index element={<PosRegister />} />
                  <Route path="caja" element={<PosRegister />} />
                  <Route path="tickets" element={<PosTickets />} />
                  <Route path="sesiones" element={<PosSessions />} />
                </Route>
                <Route path="distribucion" element={<DistributionLayout />}>
                  <Route index element={<DeliveryNotes />} />
                  <Route path="albaranes" element={<DeliveryNotes />} />
                  <Route path="rutas" element={<DeliveryRoutes />} />
                </Route>
                <Route path="contabilidad" element={<AccountingLayout />}>
                  <Route index element={<ChartOfAccounts />} />
                  <Route path="plan" element={<ChartOfAccounts />} />
                  <Route path="diario" element={<Journal />} />
                  <Route path="mayor" element={<Ledger />} />
                  <Route path="iva" element={<VatReport />} />
                  <Route path="resultado" element={<PnL />} />
                  <Route path="analitica" element={<Analytical />} />
                </Route>
                <Route path="chat" element={<Configuracion />} />
                <Route path="contasimple" element={<ContaSimpleSync />} />
                <Route path="portal" element={<DashboardGeneral />} />
                <Route path="portal/sala-corte/*" element={<SalaCorteRouter />} />
                <Route path="portal/tienda/*" element={<TiendaRouter />} />
                <Route path="portal/distribucion/*" element={<DistribucionRouter />} />
                <Route path="portal/finanzas/*" element={<FinanzasRouter />} />
                <Route path="portal/calendario" element={<CalendarioEventos />} />
                <Route path="portal/ia" element={<IaEmpresarial />} />
                <Route path="configuracion" element={<Configuracion />} />
              </Route>

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </CartProvider>
        </CustomerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
