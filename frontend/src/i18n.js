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
          "Salir": "Salir",
          "Hola, {name}": "Hola, {{name}}",
          "Mis datos": "Mis datos",
          "Direcciones": "Direcciones",
          "Mis pedidos": "Mis pedidos",
          "Pagos guardados": "Pagos guardados"
        }
      },
      en: {
        translation: {
          "Mi cuenta": "My Account",
          "Salir": "Sign out",
          "Hola, {name}": "Hello, {{name}}",
          "Mis datos": "My Profile",
          "Direcciones": "Addresses",
          "Mis pedidos": "My Orders",
          "Pagos guardados": "Saved Payments"
        }
      }
    },
    fallbackLng: 'es', // Si el idioma no está disponible, usa español
    interpolation: {
      escapeValue: false // React ya protege contra XSS
    }
  });

export default i18n;