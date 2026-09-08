import React from "react";

/**
 * Logo oficial de Las Dos Doncellas.
 *
 * Archivos servidos desde /brand/:
 *   · logo.png       — arte BLANCO sobre fondo transparente (uso sobre negro/oscuro).
 *   · logo-dark.png  — arte NEGRO sobre fondo transparente (uso sobre creamy/blanco:
 *                       emails, facturas PDF, invoices, printables).
 *
 * El PNG blanco es un rectángulo vertical 899×1280 (aspect 0.7) con:
 *   · Icono superior (~68% de altura): marco con L | D + rama de olivo.
 *   · Texto inferior (~32% de altura): "Las Dos Doncellas / Productos Ibéricos".
 *
 * Props
 *   size:    ALTURA en px (o ancho si variant='mark').
 *   variant: 'full' — imagen entera con texto integrado.
 *            'mark' — sólo el icono cuadrado (recorta el 32% inferior).
 *   tone:    'light' (default, fondo oscuro) | 'dark' (para fondo claro).
 */
export function Logo({ size = 96, variant = "full", tone = "light", className = "" }) {
  const src = tone === "dark" ? "/brand/logo-dark.png" : "/brand/logo.png";
  if (variant === "mark") {
    const scaledHeight = size / 0.7;
    return (
      <span
        className={`inline-block overflow-hidden ${className}`}
        style={{ width: size, height: size, lineHeight: 0 }}
      >
        <img
          src={src}
          alt="Las Dos Doncellas"
          draggable={false}
          style={{
            width: size,
            height: scaledHeight,
            objectFit: "cover",
            objectPosition: "50% 6%",
            display: "block",
          }}
        />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt="Las Dos Doncellas · Productos Ibéricos"
      draggable={false}
      style={{ height: size, width: "auto", objectFit: "contain" }}
      className={`inline-block ${className}`}
    />
  );
}
