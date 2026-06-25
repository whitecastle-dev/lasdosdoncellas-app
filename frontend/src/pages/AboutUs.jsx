import React from "react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";

export default function AboutUs() {
  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => {}} />
      <section className="relative h-[50vh] min-h-[360px] overflow-hidden">
        <img src="https://images.unsplash.com/photo-1534655882117-f9eff36a1574?crop=entropy&cs=srgb&fm=jpg&q=85&w=2400" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 flex items-end pb-14">
          <div className="max-w-[1500px] mx-auto w-full px-6 lg:px-12">
            <div className="label-eyebrow gold mb-3">Nosotros</div>
            <h1 className="font-serif text-5xl md:text-7xl tracking-tighter" style={{ color: "#FAF8F5" }}>
              Sierra Norte de <span className="font-script italic">Sevilla</span>
            </h1>
          </div>
        </div>
      </section>
      <div className="max-w-[900px] mx-auto px-6 py-20 text-[15px] leading-relaxed" style={{ color: "rgba(250,248,245,0.85)" }}>
        <p className="font-serif italic text-2xl gold mb-6">"Tiempo, sal y paciencia."</p>
        <p>Las Dos Doncellas nace en <strong>Castilblanco de los Arroyos</strong>, en el corazón verde de la Sierra Norte de Sevilla. Nuestros cerdos crecen en libertad entre encinas y alcornoques, y nuestras piezas se curan lentamente al aire seco y limpio de la sierra.</p>
        <p className="mt-6">Trabajamos sin atajos: salado a mano, secado natural, cata pieza a pieza. Cada jamón que sale de nuestra bodega es el resultado de años de espera y de un oficio que nuestra familia lleva cultivando generación tras generación.</p>
        <p className="mt-6">No somos los más grandes. Tampoco queremos serlo. Solo nos interesa lo bueno.</p>
        <div className="mt-12 grid sm:grid-cols-3 gap-6 text-sm border-t border-[rgba(197,160,89,0.2)] pt-10">
          <div>
            <div className="label-eyebrow gold mb-2">Domicilio fiscal</div>
            <div>Plaza Amarilla, 3<br/>41230 Castilblanco de los Arroyos<br/>Sevilla, España</div>
          </div>
          <div>
            <div className="label-eyebrow gold mb-2">CIF</div>
            <div className="font-mono-data">77815813M</div>
          </div>
          <div>
            <div className="label-eyebrow gold mb-2">Contacto</div>
            <div>info@lasdosdoncellasibericos.es</div>
          </div>
        </div>
      </div>
      <StoreFooter />
    </div>
  );
}
