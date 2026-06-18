import React, { useEffect, useRef, useState } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 5000;

export default function ChatPanel({ embedded = false }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const tokenRef = useRef(localStorage.getItem("ldd_customer_token"));

  const headers = () => {
    const t = tokenRef.current || localStorage.getItem("ldd_customer_token");
    return { Authorization: t ? `Bearer ${t}` : "", "Content-Type": "application/json" };
  };

  const load = async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/chat/my-messages`, { headers: headers(), credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/chat/send`, {
        method: "POST",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify({ message: text.trim() }),
      });
      if (r.ok) {
        setText("");
        await load();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={embedded ? "" : "max-w-2xl"} data-testid="customer-chat-panel">
      <div className="label-eyebrow gold mb-3">Contacta con nosotros</div>
      <h2 className="font-serif text-3xl tracking-tighter mb-2" style={{ color: "#FAF8F5" }}>Chat directo</h2>
      <p className="text-xs mb-5" style={{ color: "rgba(250,248,245,0.55)" }}>Nuestro equipo responde en horario comercial. Tus mensajes quedan guardados para siempre.</p>

      <div ref={scrollRef} className="border border-[rgba(197,160,89,0.2)] p-5 h-[420px] overflow-y-auto space-y-3 bg-[rgba(10,10,10,0.4)]" data-testid="chat-messages-container">
        {messages.length === 0 && (
          <div className="text-center text-sm h-full flex items-center justify-center" style={{ color: "rgba(250,248,245,0.45)" }}>
            Aún no hay mensajes. Escríbenos lo que necesites 👇
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from_admin ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[78%] px-4 py-2 ${m.from_admin ? "bg-[rgba(197,160,89,0.15)] border border-[rgba(197,160,89,0.3)]" : "bg-[#C5A059] text-black"}`} data-testid={`chat-msg-${m.id}`}>
              {m.from_admin && <div className="text-[10px] uppercase tracking-widest gold mb-1">Las Dos Doncellas</div>}
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.message}</div>
              <div className={`text-[10px] mt-1 ${m.from_admin ? "text-[rgba(250,248,245,0.5)]" : "text-black/60"}`}>{new Date(m.created_at).toLocaleString("es-ES")}</div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe tu mensaje…"
          className="flex-1 bg-transparent border border-[rgba(250,248,245,0.2)] focus:border-[#C5A059] outline-none px-4 py-3 text-sm text-[#FAF8F5]"
          data-testid="chat-input"
        />
        <button type="submit" disabled={sending || !text.trim()} className="ldd-btn-gold disabled:opacity-40" data-testid="chat-send">
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
