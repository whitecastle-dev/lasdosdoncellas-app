import React, { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import StoreHeader from "@/components/storefront/StoreHeader";
import StoreFooter from "@/components/storefront/StoreFooter";
import { api, formatMoney } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState({ status: "checking", payment_status: null, order_number: null });
  const [order, setOrder] = useState(null);
  const polledRef = useRef(0);
  const { clear } = useCart();

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const poll = async () => {
      polledRef.current += 1;
      try {
        const { data } = await api.get(`/checkout/status/${sessionId}`);
        if (cancelled) return;
        setStatus(data);
        if (data.payment_status === "paid") {
          clear();
          try {
            const r = await api.get(`/orders/by-session/${sessionId}`);
            setOrder(r.data);
          } catch {}
          return;
        }
        if (data.status === "expired" || polledRef.current >= 12) return;
        setTimeout(poll, 2500);
      } catch {
        if (polledRef.current < 12) setTimeout(poll, 3000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, clear]);

  const paid = status.payment_status === "paid";
  const expired = status.status === "expired";

  return (
    <div className="ldd-storefront min-h-screen">
      <StoreHeader onOpenCart={() => {}} />
      <div className="max-w-[900px] mx-auto px-6 py-24 text-center">
        {paid && (
          <div className="fade-up">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#C5A059] flex items-center justify-center mb-6">
              <Check size={28} className="text-black" />
            </div>
            <div className="label-eyebrow gold mb-3">Pago confirmado</div>
            <h1 className="font-serif text-5xl md:text-7xl tracking-tighter leading-[0.95]" style={{ color: "#FAF8F5" }} data-testid="success-heading">
              Gracias por tu pedido
            </h1>
            <p className="mt-6 max-w-md mx-auto" style={{ color: "rgba(250,248,245,0.7)" }}>
              Estamos preparando tu pedido <span className="gold font-mono-data">{order?.order_number || status.order_number}</span> con todo el mimo.
              Recibirás un email con los detalles.
            </p>
            {order && (
              <div className="mt-10 inline-block text-left border border-[rgba(197,160,89,0.25)] p-6 min-w-[320px]">
                <div className="label-eyebrow gold mb-3">Resumen</div>
                {order.items?.map((i) => (
                  <div key={i.product_id} className="flex justify-between text-sm py-1" data-testid={`success-item-${i.product_id}`}>
                    <span>{i.name} × {i.qty}</span>
                    <span className="font-mono-data">{formatMoney(i.line_total)}</span>
                  </div>
                ))}
                <div className="border-t border-[rgba(197,160,89,0.25)] mt-3 pt-3 flex justify-between">
                  <span className="label-eyebrow">Total</span>
                  <span className="font-serif text-2xl gold">{formatMoney(order.total)}</span>
                </div>
              </div>
            )}
            <div className="mt-10">
              <Link to="/" className="ldd-btn-gold" data-testid="success-continue">
                Seguir comprando <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {!paid && !expired && (
          <div>
            <div className="label-eyebrow gold mb-3">Verificando pago…</div>
            <h1 className="font-serif text-4xl tracking-tighter" style={{ color: "#FAF8F5" }}>Un momento, por favor</h1>
            <p className="mt-4" style={{ color: "rgba(250,248,245,0.6)" }}>Estamos confirmando con Stripe.</p>
          </div>
        )}

        {expired && (
          <div>
            <div className="label-eyebrow gold mb-3">Sesión expirada</div>
            <h1 className="font-serif text-4xl tracking-tighter" style={{ color: "#FAF8F5" }}>El pago no se completó</h1>
            <Link to="/cart" className="ldd-btn-gold mt-8 inline-flex" data-testid="success-retry">Volver a intentar</Link>
          </div>
        )}
      </div>
      <StoreFooter />
    </div>
  );
}
