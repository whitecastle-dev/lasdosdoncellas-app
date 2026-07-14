import React from "react";

/**
 * Logo — usa la imagen oficial de la marca `/brand/logo.png`.
 *
 * El PNG oficial contiene DOS partes verticalmente:
 *   1. Un cuadro con las iniciales L|D y una rama de olivo (icono).
 *   2. El texto "Las Dos Doncellas / Productos Ibéricos" debajo.
 *
 * Modos:
 *   variant="full"  → muestra la imagen completa (icono + texto).
 *                     Usar en Footer o pantallas amplias (login, hero).
 *   variant="mark"  → sólo el icono cuadrado (recorta la parte inferior).
 *                     Usar en headers compactos donde el nombre ya aparece
 *                     como texto lateral, o cuando el espacio vertical es
 *                     limitado. Se aplica clip-path para ocultar el texto.
 *
 * `size` es la altura en px de la imagen final.
 */
export function Logo({ size = 56, variant = "full", className = "" }) {
  const src = "/brand/logo.png";
  if (variant === "mark") {
    // La zona del icono ocupa aprox. el 68% superior del PNG.
    // Recortamos el 32% inferior con inset-clip para eliminar el texto.
    return (
      <span
        className={`inline-block overflow-hidden ${className}`}
        style={{ height: size, width: size, lineHeight: 0 }}
      >
        <img
          src={src}
          alt="Las Dos Doncellas"
          draggable={false}
          style={{
            // La imagen es más alta que ancha; escalamos por altura y
            // recortamos abajo para quedarnos con el icono cuadrado.
            height: size * 1.47,
            width: "auto",
            objectFit: "cover",
            objectPosition: "50% 0%",
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
