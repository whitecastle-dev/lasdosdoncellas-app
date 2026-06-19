import React from "react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";

export default function LegalLayout({ eyebrow, title, lastUpdate, children }) {
  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader />
      <main className="max-w-3xl mx-auto px-6 lg:px-12 pt-32 pb-24" data-testid="legal-page">
        <div className="label-eyebrow gold mb-3">{eyebrow || "Información legal"}</div>
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mb-4" style={{ color: "#FAF8F5" }}>
          {title}
        </h1>
        {lastUpdate && (
          <p className="text-xs mb-10 mono" style={{ color: "rgba(250,248,245,0.55)" }}>
            Última actualización: {lastUpdate}
          </p>
        )}
        <article
          className="legal-prose space-y-5 leading-relaxed"
          style={{ color: "rgba(250,248,245,0.85)", fontSize: "0.95rem" }}
        >
          {children}
        </article>
      </main>
      <StoreFooter />
    </div>
  );
}
