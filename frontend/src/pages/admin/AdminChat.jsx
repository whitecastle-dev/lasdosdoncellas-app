import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const POLL_MS = 5000;

export default function AdminChat() {
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const loadThreads = async () => {
    try {
      const r = await api.get("/chat/threads");
      setThreads(r.data);
    } catch {}
  };

  const loadMessages = async (userId) => {
    try {
      const r = await api.get(`/chat/messages/${userId}`);
      setMessages(r.data);
    } catch {}
  };

  useEffect(() => {
    loadThreads();
    const id = setInterval(() => {
      loadThreads();
      if (selected) loadMessages(selected.user_id);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [selected]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const openThread = (t) => {
    setSelected(t);
    loadMessages(t.user_id);
  };

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    try {
      await api.post("/chat/send", { message: text.trim(), to_user_id: selected.user_id });
      setText("");
      await loadMessages(selected.user_id);
      await loadThreads();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSending(false); }
  };

  return (
    <div className="p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <div className="label-eyebrow text-gray-500">Comunicación</div>
        <h1 className="font-serif text-4xl tracking-tight mt-1">Conversaciones</h1>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6 h-[600px]">
        {/* Lista threads */}
        <div className="cms-card overflow-y-auto">
          {threads.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">
              <MessageCircle size={28} className="mx-auto mb-2 text-gray-300" />
              Aún no hay conversaciones
            </div>
          )}
          {threads.map((t) => (
            <button
              key={t.user_id}
              onClick={() => openThread(t)}
              className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition ${selected?.user_id === t.user_id ? "bg-gray-50" : ""}`}
              data-testid={`thread-${t.user_id}`}
            >
              <div className="flex justify-between items-start">
                <div className="font-medium text-sm">{t.user_name}</div>
                {t.unread > 0 && (
                  <span className="bg-[#C5A059] text-black text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold" data-testid={`thread-unread-${t.user_id}`}>{t.unread}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate">{t.last_from_admin ? "Tú: " : ""}{t.last_message}</div>
              <div className="text-[10px] text-gray-400 mt-1">{new Date(t.last_at).toLocaleString("es-ES")}</div>
            </button>
          ))}
        </div>

        {/* Chat */}
        <div className="cms-card flex flex-col">
          {!selected && (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Selecciona una conversación
            </div>
          )}
          {selected && (
            <>
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="font-serif text-lg">{selected.user_name}</div>
                <div className="text-xs text-gray-500">{selected.user_email}</div>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from_admin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-sm text-sm ${m.from_admin ? "bg-[#C5A059] text-black" : "bg-white border border-gray-200"}`} data-testid={`admin-msg-${m.id}`}>
                      <div className="whitespace-pre-wrap leading-relaxed">{m.message}</div>
                      <div className={`text-[10px] mt-1 ${m.from_admin ? "text-black/60" : "text-gray-400"}`}>{new Date(m.created_at).toLocaleString("es-ES")}</div>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="border-t border-gray-100 p-3 flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu respuesta…" className="flex-1 border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" data-testid="admin-chat-input" />
                <button type="submit" disabled={sending || !text.trim()} className="px-4 py-2 bg-black text-[#C5A059] text-sm flex items-center gap-2 disabled:opacity-50" data-testid="admin-chat-send">
                  <Send size={12} /> Enviar
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
