import React, { Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

// Asegúrate de importar i18n para que las configuraciones se carguen
import "@/i18n"; 

import { AuthProvider } from "@/context/AuthContext";
import { CustomerProvider } from "@/context/CustomerContext";
import { CartProvider } from "@/context/CartContext";

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
import ProductsAdmin from "@/pages/admin/Products";
import OrdersAdmin from "@/pages/admin/Orders";
import UsersAdmin from "@/pages/admin/Users";
import ProvidersAdmin from "@/pages/admin/Providers";
import AdminChat from "@/pages/admin/AdminChat";

import AvisoLegal from "@/pages/legal/AvisoLegal";
import PoliticaPrivacidad from "@/pages/legal/PoliticaPrivacidad";
import PoliticaCookies from "@/pages/legal/PoliticaCookies";

function App() {
  return (
    <Suspense fallback="Cargando...">
      <AuthProvider>
        <CustomerProvider>
          <CartProvider>
            <BrowserRouter>
              <Toaster position="top-right" richColors theme="dark" />
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
                  <Route index element={<Dashboard />} />
                  <Route path="products" element={<ProductsAdmin />} />
                  <Route path="orders" element={<OrdersAdmin />} />
                  <Route path="providers" element={<ProvidersAdmin />} />
                  <Route path="users" element={<UsersAdmin />} />
                  <Route path="chat" element={<AdminChat />} />
                </Route>

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </CustomerProvider>
      </AuthProvider>
    </Suspense>
  );
}

export default App;