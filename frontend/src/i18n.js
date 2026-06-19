import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector) // Detecta el idioma del navegador del usuario automáticamente
  .use(initReactI18next) // Conecta i18next con React
  .init({
    resources: {
      es: {
        translation: {
          "Mi cuenta": "Mi cuenta",
          "Cuenta": "Cuenta",
          "Salir": "Salir",
          "Cerrar sesión": "Cerrar sesión",
          "Hola, {{name}}": "Hola, {{name}}",
          "Mis datos": "Mis datos",
          "Mi perfil": "Mi perfil",
          "Direcciones": "Direcciones",
          "Mis pedidos": "Mis pedidos",
          "Pagos guardados": "Pagos guardados",
          "Inicio": "Inicio",
          "Catálogo": "Catálogo",
          "Configurar lote": "Configurar lote",
          "Nosotros": "Nosotros",
          "Acceder": "Acceder",
          "Cesta": "Cesta",
          "Cambiar contraseña": "Cambiar contraseña"
        }
      },
      en: {
        translation: {
          "Mi cuenta": "My Account",
          "Cuenta": "Account",
          "Salir": "Sign out",
          "Cerrar sesión": "Sign out",
          "Hola, {{name}}": "Hello, {{name}}",
          "Mis datos": "My Profile",
          "Mi perfil": "My Profile",
          "Direcciones": "Addresses",
          "Mis pedidos": "My Orders",
          "Pagos guardados": "Saved Payments",
          "Inicio": "Home",
          "Catálogo": "Catalog",
          "Configurar lote": "Configure batch",
          "Nosotros": "About Us",
          "Acceder": "Sign in",
          "Cesta": "Cart",
          "Cambiar contraseña": "Change password"
        }
      }
    },
    fallbackLng: 'es', // Si el idioma no está disponible, usa español
    interpolation: {
      escapeValue: false // React ya protege contra XSS
    }
  });

export default i18n;