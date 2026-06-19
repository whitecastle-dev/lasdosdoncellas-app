import React from "react";
import LegalLayout from "./LegalLayout";

export default function PoliticaCookies() {
  return (
    <LegalLayout eyebrow="Cookies" title="Política de cookies" lastUpdate="2026">
      <p>
        En esta web se utilizan cookies propias y de terceros con la finalidad de mejorar la experiencia de
        usuario, analizar el tráfico y, en su caso, mostrar contenido personalizado.
      </p>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">¿Qué es una cookie?</h2>
      <p>
        Una cookie es un pequeño archivo que se descarga en tu navegador al acceder a determinadas páginas web.
        Sirven, por ejemplo, para recordar tus preferencias, saber si has iniciado sesión o hacer estadísticas
        de uso.
      </p>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Tipos de cookies que se pueden usar en esta web</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>
          <strong>Cookies técnicas o necesarias:</strong> permiten que la web funcione (iniciar sesión,
          mantener el carrito de la compra, procesar pedidos…). Son obligatorias para el funcionamiento del
          sitio.
        </li>
        <li>
          <strong>Cookies de personalización:</strong> permiten recordar tus preferencias, como el idioma.
        </li>
        <li>
          <strong>Cookies de análisis:</strong> permiten obtener estadísticas anónimas sobre el uso de la web
          (páginas más visitadas, tiempo de permanencia, etc.).
        </li>
        <li>
          <strong>Cookies de redes sociales o marketing:</strong> se usan para integrar funciones de redes
          sociales o, en su caso, mostrar contenido o anuncios personalizados.
        </li>
      </ul>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Cookies propias</h2>
      <p>L2D Ibéricos utiliza cookies técnicas necesarias para:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Mantener la sesión del usuario.</li>
        <li>Recordar los productos del carrito de compra.</li>
        <li>Procesar pedidos en la tienda online.</li>
      </ul>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Cookies de terceros</h2>
      <p>Se pueden instalar cookies de terceros asociadas, por ejemplo, a:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Google (analítica y fuentes tipográficas).</li>
        <li>Redes sociales (Instagram, Facebook) si se muestran botones o contenidos incrustados.</li>
      </ul>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Cómo modificar la configuración de cookies</h2>
      <p>
        El usuario puede permitir, bloquear o eliminar las cookies instaladas en su equipo mediante la
        configuración del navegador.
      </p>
      <p>Los pasos pueden variar según el navegador (Chrome, Safari, Firefox, Edge, etc.).</p>
      <p>
        Ten en cuenta que si desactivas las cookies técnicas, el sitio puede dejar de funcionar correctamente
        (especialmente la parte de tienda).
      </p>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Aceptación de cookies</h2>
      <p>Al acceder por primera vez a esta web se muestra un aviso de cookies.</p>
      <p>
        Si continúas navegando o haces clic en «Aceptar», se entenderá que consientes el uso de las cookies
        descritas.
      </p>
      <p>
        En cualquier momento puedes cambiar la configuración de tu navegador para gestionar o eliminar las
        cookies.
      </p>
    </LegalLayout>
  );
}
