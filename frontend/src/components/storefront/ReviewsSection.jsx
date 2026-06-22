import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useCustomer } from "@/context/CustomerContext";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import StarRating from "@/components/StarRating";

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ""; }
}

export default function ReviewsSection({ productId, initialAvg = 0, initialCount = 0, onStatsChange }) {
  const { customer } = useCustomer();
  const [items, setItems] = useState([]);
  const [avg, setAvg] = useState(initialAvg);
  const [count, setCount] = useState(initialCount);
  const [dist, setDist] = useState({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 });
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const r = await api.get(`/reviews/product/${productId}`);
      setItems(r.data.items || []);
      setAvg(r.data.avg_rating || 0);
      setCount(r.data.review_count || 0);
      setDist(r.data.distribution || dist);
      onStatsChange?.({ avg: r.data.avg_rating, count: r.data.review_count });
    } catch { /* silent */ }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [productId]);

  const ownReview = customer && items.find((r) => r.customer_id === customer.id);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!rating) { toast.error("Selecciona una puntuación"); return; }
    setSending(true);
    try {
      await api.post("/reviews", { product_id: productId, rating, comment });
      toast.success(ownReview ? "Reseña actualizada" : "Gracias por tu reseña");
      setShowForm(false);
      setComment("");
      setRating(0);
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSending(false); }
  };

  const startEdit = () => {
    if (ownReview) { setRating(ownReview.rating); setComment(ownReview.comment || ""); }
    setShowForm(true);
  };

  return (
    <section className="mt-20 border-t pt-12" style={{ borderColor: "rgba(197,160,89,0.18)" }} data-testid="reviews-section">
      <div className="grid md:grid-cols-3 gap-12">
        {/* Resumen */}
        <div>
          <div className="label-eyebrow gold mb-2">Opiniones</div>
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight" style={{ color: "#FAF8F5" }}>
            Reseñas
          </h2>
          <div className="mt-6 flex items-center gap-3">
            <span className="font-serif text-5xl gold" data-testid="reviews-avg">{Number(avg).toFixed(1)}</span>
            <div>
              <StarRating value={avg} size={18} readOnly />
              <div className="text-xs mt-1" style={{ color: "rgba(250,248,245,0.55)" }} data-testid="reviews-count">
                {count} {count === 1 ? "reseña" : "reseñas"}
              </div>
            </div>
          </div>
          {/* Distribución por estrellas */}
          <div className="mt-6 space-y-1.5">
            {[5, 4, 3, 2, 1].map((s) => {
              const c = dist[String(s)] || 0;
              const pct = count > 0 ? Math.round((c / count) * 100) : 0;
              return (
                <div key={s} className="flex items-center gap-3 text-xs" style={{ color: "rgba(250,248,245,0.7)" }}>
                  <span className="w-3 mono">{s}</span>
                  <div className="flex-1 h-1.5 bg-[rgba(197,160,89,0.12)] overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, background: "#C5A059" }} />
                  </div>
                  <span className="w-8 mono text-right">{c}</span>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-8">
            {customer ? (
              <button
                onClick={startEdit}
                className="ldd-btn-gold-outline"
                data-testid="open-review-form"
              >
                {ownReview ? "Editar mi reseña" : "Escribir reseña"}
              </button>
            ) : (
              <Link to="/cuenta/login" className="ldd-btn-gold-outline" data-testid="reviews-login-cta">
                Inicia sesión para reseñar
              </Link>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="md:col-span-2">
          {showForm && (
            <form onSubmit={submit} className="border p-6 mb-8" style={{ borderColor: "rgba(197,160,89,0.25)" }} data-testid="review-form">
              <div className="label-eyebrow gold mb-3">Tu valoración</div>
              <StarRating value={rating} onChange={setRating} size={28} testid="review-input-rating" />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Cuéntanos qué te ha parecido (opcional)"
                rows={4}
                maxLength={1500}
                data-testid="review-input-comment"
                className="mt-4 w-full bg-transparent border border-[rgba(250,248,245,0.18)] focus:border-[#C5A059] outline-none px-3 py-3 text-sm"
                style={{ color: "#FAF8F5" }}
              />
              <div className="mt-4 flex items-center gap-3">
                <button type="submit" disabled={sending} className="ldd-btn-gold" data-testid="review-submit">
                  {sending ? "Enviando…" : "Publicar reseña"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="text-xs label-eyebrow text-[rgba(250,248,245,0.55)] hover:text-[#C5A059]">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {items.length === 0 && (
            <div className="text-sm" style={{ color: "rgba(250,248,245,0.55)" }} data-testid="reviews-empty">
              Aún no hay opiniones. ¡Sé el primero en compartir la tuya!
            </div>
          )}
          <ul className="space-y-6">
            {items.map((r) => (
              <li key={r.id} className="border-t pt-6 first:border-t-0 first:pt-0" style={{ borderColor: "rgba(197,160,89,0.12)" }} data-testid={`review-${r.id}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-serif text-lg" style={{ color: "#FAF8F5" }}>{r.customer_name}</div>
                    <StarRating value={r.rating} size={14} readOnly />
                  </div>
                  <div className="text-xs mono" style={{ color: "rgba(250,248,245,0.45)" }}>{fmtDate(r.created_at)}</div>
                </div>
                {r.comment && (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(250,248,245,0.78)" }}>{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
