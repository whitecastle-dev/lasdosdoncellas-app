import React from "react";

/**
 * Logo — usa la imagen oficial de la marca. El PNG ya trae el
 * texto "Las Dos Doncellas · Productos Ibéricos" incorporado.
 *
 * Props:
 *   size    → alto en px de la imagen (por defecto 56).
 *   showText → si true (default) muestra la imagen entera. Si false,
 *              recorta y muestra sólo el icono cuadrado (útil para
 *              headers muy compactos o favicons).
 */
export function Logo({ size = 56, className = "", showText = true, tone = "light" }) {
  // El PNG original es blanco/dorado sobre fondo negro. Sobre fondos claros
  // lo envolvemos en un pequeño chip oscuro para mantener contraste.
  const src = "/brand/logo.png";
  if (!showText) {
    return (
      <img
        src={src}
        alt="Las Dos Doncellas"
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          objectPosition: "50% 30%", // recorta el icono superior
        }}
        className={`inline-block ${className}`}
      />
    );
  }
  return (
    <img
      src={src}
      alt="Las Dos Doncellas · Productos Ibéricos"
      style={{
        height: size,
        width: "auto",
        objectFit: "contain",
        // subtle background pill for placement on light headers
        background: tone === "dark" ? "transparent" : "transparent",
      }}
      className={`inline-block ${className}`}
      draggable={false}
    />
  );
}
