import React from "react";
import { useNavigate } from "react-router-dom";
import { X, Trash2, Plus, Minus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatMoney, fileUrl } from "@/lib/api";

export default function CartDrawer({ open, onClose }) {
  const { items, updateQty, removeItem, total } = useCart();
  const navigate = useNavigate();

  if (!open) return null;

  const imgSrc = (img) => {
    if (!img) return null;
    if (img.startsWith("/api/")) return `${process.env.REACT_APP_BACKEND_URL}${img}`;
    return fileUrl(img);
  };

  return (
    <div className="fixed inset-0 z-50 cart-backdrop" onClick={onClose} data-testid="cart-drawer-backdrop">
      <div
        className="absolute right-0 top-0 bottom-0 w-full sm:w-[440px] flex flex-col"
        style={{ background: "#0A0A0A", color: "#FAF8F5", borderLeft: "1px solid rgba(197,160,89,0.25)" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="cart-drawer"
      >
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.18)" }}>
          <div>
            <div className="label-eyebrow gold">Tu cesta</div>
            <div className="font-serif text-2xl mt-1">{items.length} {items.length === 1 ? "producto" : "productos"}</div>
          </div>
          <button onClick={onClose} className="hover:text-[#C5A059]" data-testid="cart-close-button">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {items.length === 0 && (
            <div className="text-center py-20" style={{ color: "rgba(250,248,245,0.55)" }}>
              Tu cesta está vacía
            </div>
          )}
          {items.map((it) => (
            <div key={it.product_id} className="flex gap-4 pb-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.12)" }} data-testid={`cart-item-${it.product_id}`}>
              <div className="w-20 h-20 bg-[#1a1a1a] overflow-hidden flex-shrink-0">
                {it.image && <img src={imgSrc(it.image)} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-lg leading-tight truncate">{it.name}</div>
                <div className="text-sm gold mt-1">{formatMoney(it.price)}</div>
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => updateQty(it.product_id, it.qty - 1)} className="w-7 h-7 border border-[rgba(250,248,245,0.2)] hover:border-[#C5A059] flex items-center justify-center" data-testid={`cart-qty-dec-${it.product_id}`}>
                    <Minus size={12} />
                  </button>
                  <span className="text-sm font-mono-data">{it.qty}</span>
                  <button onClick={() => updateQty(it.product_id, it.qty + 1)} className="w-7 h-7 border border-[rgba(250,248,245,0.2)] hover:border-[#C5A059] flex items-center justify-center" data-testid={`cart-qty-inc-${it.product_id}`}>
                    <Plus size={12} />
                  </button>
                  <button onClick={() => removeItem(it.product_id)} className="ml-auto text-[#FAF8F5]/50 hover:text-[#8C211E]" data-testid={`cart-remove-${it.product_id}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="text-right font-mono-data">{formatMoney(it.price * it.qty)}</div>
            </div>
          ))}
        </div>

        <div className="px-6 py-5" style={{ borderTop: "1px solid rgba(197,160,89,0.18)" }}>
          <div className="flex items-center justify-between mb-5">
            <span className="label-eyebrow">Total</span>
            <span className="font-serif text-3xl gold" data-testid="cart-total-amount">{formatMoney(total)}</span>
          </div>
          <button
            disabled={items.length === 0}
            onClick={() => { onClose(); navigate("/checkout"); }}
            className="ldd-btn-gold w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="cart-checkout-button"
          >
            Finalizar compra
          </button>
        </div>
      </div>
    </div>
  );
}
