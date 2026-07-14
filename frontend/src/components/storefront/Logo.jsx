import React from "react";

/**
 * Logo oficial de Las Dos Doncellas (portrait, fondo negro, aspecto ~0.7).
 * El PNG en `/brand/logo.png` es un rectángulo vertical con:
 *   · Icono superior (~68% de altura): marco blanco con L | D + rama de olivo.
 *   · Texto inferior (~32% de altura): "Las Dos Doncellas / Productos Ibéricos".
 *
 * Variantes:
 *   variant="full"  — imagen entera. `size` es la ALTURA en px.
 *   variant="mark"  — sólo el icono cuadrado (recorta el 32% inferior de texto).
 *                     Ideal para headers/sidebars compactos donde el nombre de
 *                     la marca ya aparece como texto adyacente.
 */
export function Logo({ size = 96, variant = "full", className = "" }) {
  const src = "/brand/logo.png";
  if (variant === "mark") {
    // La imagen es 899×1280 (aspect 0.7). El icono ocupa aprox. la parte superior
    // (~68% de la altura). Para que quede cuadrado (tamaño × tamaño) escalamos la
    // imagen a que su ancho ≈ size y recortamos abajo para dejar sólo el icono.
    // Como el icono es más alto que ancho dentro de la caja (marco vertical),
    // usamos width=size y height proporcional; luego cortamos altura al tamaño.
    const scaledHeight = size / 0.7; // altura completa a la que quedaría la imagen
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
