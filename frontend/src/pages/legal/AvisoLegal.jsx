import React from "react";
import LegalLayout from "./LegalLayout";

export default function AvisoLegal() {
  return (
    <LegalLayout eyebrow="Información legal" title="Aviso legal" lastUpdate="2026">
      <p>
        Las Dos Doncellas Ibéricos (en adelante, <strong>“L2D Ibéricos”</strong>) es la titular del sitio web{" "}
        <strong>lasdosdoncellasibericos.es</strong>.
      </p>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Titular del sitio web</h2>
      <ul className="list-disc list-inside space-y-1">
        <li>Nombre comercial: Las Dos Doncellas Ibéricos</li>
        <li>Actividad: venta de productos ibéricos y servicios de corte y catas</li>
        <li>Correo electrónico de contacto: info@lasdosdoncellasibericos.es</li>
      </ul>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Objeto de la web</h2>
      <p>
        Este sitio web tiene como finalidad mostrar y vender productos ibéricos, así como informar sobre los
        servicios de corte profesional y catas de ibéricos ofrecidos por L2D Ibéricos.
      </p>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Condiciones de uso</h2>
      <p>
        El acceso y/o uso de este sitio web atribuye la condición de usuario, que acepta desde dicho acceso y/o
        uso las presentes condiciones.
      </p>
      <p>
        El usuario se compromete a hacer un uso adecuado de los contenidos y servicios, y a no emplearlos para
        actividades ilícitas, ilegales o contrarias a la buena fe y al orden público.
      </p>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Responsabilidad</h2>
      <p>
        L2D Ibéricos no se hace responsable de los daños o perjuicios derivados del uso de la información
        contenida en este sitio web ni de las decisiones que se tomen en base a ella, ni de los posibles errores
        u omisiones que puedan existir.
      </p>
      <p>Tampoco se hace responsable de los contenidos de otros sitios web enlazados desde esta página.</p>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Propiedad intelectual</h2>
      <p>
        Todos los contenidos de esta web (textos, imágenes, logotipos, diseño, etc.) son propiedad de L2D
        Ibéricos o de terceros que han autorizado su uso.
      </p>
      <p>
        Queda prohibida la reproducción, distribución o modificación de dichos contenidos sin autorización
        expresa.
      </p>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Enlaces externos</h2>
      <p>
        Este sitio web puede contener enlaces a páginas de terceros. L2D Ibéricos no es responsable de los
        contenidos ni de las políticas de privacidad de dichos sitios.
      </p>

      <h2 className="font-serif text-2xl mt-10 mb-3 gold">Legislación aplicable</h2>
      <p>
        Con carácter general, las relaciones entre L2D Ibéricos y los usuarios de la web se someten a la
        legislación y jurisdicción españolas.
      </p>
    </LegalLayout>
  );
}
