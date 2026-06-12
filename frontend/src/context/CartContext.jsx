import React, { createContext, useContext, useEffect, useState } from "react";

const CartCtx = createContext();
const KEY = "ldd_cart_v1";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((p) => p.product_id === product.id);
      if (found) {
        return prev.map((p) => p.product_id === product.id ? { ...p, qty: p.qty + qty } : p);
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        image: (product.image_urls && product.image_urls[0]) || null,
        qty,
      }];
    });
  };

  const updateQty = (product_id, qty) => {
    if (qty <= 0) return removeItem(product_id);
    setItems((prev) => prev.map((p) => p.product_id === product_id ? { ...p, qty } : p));
  };

  const removeItem = (product_id) => {
    setItems((prev) => prev.filter((p) => p.product_id !== product_id));
  };

  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartCtx.Provider value={{ items, addItem, updateQty, removeItem, clear, count, total }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => useContext(CartCtx);
