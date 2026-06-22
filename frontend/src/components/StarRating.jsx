import React, { useState } from "react";

/**
 * Componente de estrellas reutilizable.
 * - Modo display: pasa `value` (0..5, puede ser decimal) y `readOnly`.
 * - Modo input: pasa `value` + `onChange`. Hace hover preview.
 */
export default function StarRating({
  value = 0,
  onChange,
  size = 16,
  readOnly = false,
  showNumber = false,
  count = null,
  testid,
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  const star = (i) => {
    const filled = display >= i;
    const half = !filled && display >= i - 0.5;
    return (
      <button
        type="button"
        key={i}
        disabled={readOnly}
        onMouseEnter={() => !readOnly && setHover(i)}
        onMouseLeave={() => !readOnly && setHover(0)}
        onClick={() => !readOnly && onChange?.(i)}
        className={readOnly ? "cursor-default" : "cursor-pointer transition"}
        data-testid={testid ? `${testid}-star-${i}` : undefined}
        style={{ background: "none", border: "none", padding: 0, lineHeight: 0 }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <defs>
            <linearGradient id={`half-${i}-${size}`}>
              <stop offset="50%" stopColor="#C5A059" />
              <stop offset="50%" stopColor="rgba(197,160,89,0.22)" />
            </linearGradient>
          </defs>
          <path
            d="M12 2l2.95 6.65 7.05.55-5.4 4.7 1.7 7.1L12 17.3 5.7 21l1.7-7.1L2 9.2l7.05-.55L12 2z"
            fill={filled ? "#C5A059" : half ? `url(#half-${i}-${size})` : "rgba(197,160,89,0.22)"}
            stroke="#C5A059"
            strokeWidth="0.6"
          />
        </svg>
      </button>
    );
  };

  return (
    <div className="inline-flex items-center gap-1 notranslate" translate="no" data-testid={testid}>
      <div className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map(star)}</div>
      {showNumber && value > 0 && (
        <span className="text-xs ml-1 mono" style={{ color: "rgba(250,248,245,0.65)" }}>
          {Number(value).toFixed(1)}
        </span>
      )}
      {count !== null && count !== undefined && (
        <span className="text-xs ml-1" style={{ color: "rgba(250,248,245,0.5)" }}>
          ({count})
        </span>
      )}
    </div>
  );
}
