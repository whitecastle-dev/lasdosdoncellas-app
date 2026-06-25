import React from "react";
import { Navigate, useParams } from "react-router-dom";

// Mantenemos esta ruta por compatibilidad con enlaces antiguos.
// Redirige al catálogo filtrado por la categoría, que ya gestiona
// el caso "no hay productos" y permite buscar/ordenar.
export default function CategoryPage() {
  const { slug } = useParams();
  return <Navigate to={`/catalogo?categoria=${slug}`} replace />;
}
