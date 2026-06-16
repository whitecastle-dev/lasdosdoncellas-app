import React, { useEffect, useState } from "react";
import { customerApi } from "@/context/CustomerContext";

export default function Orders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    customerApi.get("/orders").then(res => setOrders(res.data));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h1 className="text-2xl mb-6">Mis Pedidos</h1>
      {orders.length === 0 ? <p>No tienes pedidos aún.</p> : (
        <div className="grid gap-4">
          {orders.map(order => (
            <div key={order.id} className="border border-neutral-800 p-4 flex justify-between">
              <span>Pedido #{order.id}</span>
              <span>{order.status}</span>
              <span>{order.total} €</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}