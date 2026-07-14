import React, { useEffect, useRef, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useCustomer } from "@/context/CustomerContext";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import StarRating from "@/components/StarRating";

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ""; }
}

const MAX_IMAGES = 3;

export default function ReviewsSection({ productId, initialAvg = 0, initialCount = 0, onStatsChange }) {
  const { customer } = useCustomer();
  const [items, setItems] = useState([]);
  const [avg, setAvg] = useState(initialAvg);
  const [count, setCount] = useState(initialCount);
  const [dist, setDist] = useState({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 });
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageUrls, setImageUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [googleReview, setGoogleReview] = useState(null); // {enabled, write_review_url}
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/settings/public");
        if (r.data?.google?.enabled) setGoogleReview(r.data.google);
      } catch { /* ignore */ }
    })();
  }, []);

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

  const uploadImage = async (file) => {
    if (!file) return;
    if (imageUrls.length >= MAX_IMAGES) {
      toast.error(`Máximo ${MAX_IMAGES} fotos`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/reviews/upload-image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImageUrls((u) => [...u, r.data.url]);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const removeImage = (url) => setImageUrls((u) => u.filter((x) => x !== url));

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!rating) { toast.error("Selecciona una puntuación"); return; }
    setSending(true);
    try {
      await api.post("/reviews", { product_id: productId, rating, comment, image_urls: imageUrls });
      toast.success(ownReview ? "Reseña actualizada" : "Gracias por tu reseña");
      setShowForm(false);
      setComment("");
      setImageUrls([]);
      // Solo proponemos Google si la puntuación era alta (4-5 estrellas) — buena práctica
      if (!ownReview && googleReview?.write_review_url && rating >= 4) {
        setShowGooglePrompt(true);
      }
      setRating(0);
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSending(false); }
  };

  const startEdit = () => {
    if (ownReview) {
      setRating(ownReview.rating);
      setComment(ownReview.comment || "");
      setImageUrls(ownReview.image_urls || []);
    }
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
                {(r.image_urls || []).length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {r.image_urls.map((u, i) => (
                      <button
                        key={u + i}
                        type="button"
                        onClick={() => setLightbox(u)}
                        className="block focus:outline-none"
                        data-testid={`review-photo-${r.id}-${i}`}
                      >
                        <img
                          src={u}
                          alt=""
                          loading="lazy"
                          className="w-20 h-20 object-cover hover:opacity-90 transition cursor-zoom-in"
                          style={{ border: "1px solid rgba(197,160,89,0.18)" }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Lightbox de fotos de reseña */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 cursor-zoom-out"
          data-testid="review-lightbox"
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Prompt Google Maps tras enviar reseña positiva */}
      {showGooglePrompt && googleReview?.write_review_url && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-6"
          onClick={() => setShowGooglePrompt(false)}
          data-testid="google-review-prompt"
        >
          <div
            className="max-w-md w-full p-8 relative"
            style={{ background: "#0A0A0A", border: "1px solid rgba(197,160,89,0.35)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowGooglePrompt(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-white"
              aria-label="Cerrar"
              data-testid="google-prompt-close"
            >
              <X size={18} />
            </button>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
                   style={{ background: "rgba(66,133,244,0.15)", border: "1px solid rgba(66,133,244,0.4)" }}>
                <svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true">
                  <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              </div>
              <h3 className="font-serif text-2xl mb-2" style={{ color: "#FAF8F5" }}>
                ¿Nos ayudas también en Google?
              </h3>
              <p className="text-sm mb-6" style={{ color: "rgba(250,248,245,0.7)" }}>
                Gracias por tus <span className="gold">{rating || 5} estrellas</span>. Publicar la misma
                reseña en <strong>Google Maps</strong> nos ayuda muchísimo a que otros amantes del
                ibérico nos descubran. Sólo te llevará 30 segundos.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={googleReview.write_review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowGooglePrompt(false)}
                  data-testid="google-review-open"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium"
                  style={{ background: "#C5A059", color: "#0A0A0A" }}
                >
                  Publicar en Google Maps
                </a>
                <button
                  onClick={() => setShowGooglePrompt(false)}
                  data-testid="google-review-skip"
                  className="flex-1 px-5 py-3 text-sm border"
                  style={{ borderColor: "rgba(197,160,89,0.3)", color: "rgba(250,248,245,0.7)" }}
                >
                  Ahora no
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
