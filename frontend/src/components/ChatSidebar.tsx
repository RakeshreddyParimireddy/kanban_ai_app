import { useState, type FormEvent } from "react";
import { sendChat, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  isOpen: boolean;
  isSending: boolean;
  onSendingChange: (isSending: boolean) => void;
  onClose: () => void;
  onBoardChange: (board: BoardData) => void;
};

// Stays mounted while closed so the conversation is kept.
// isSending lives in the board so it can block edits while the AI works on the board.
export const ChatSidebar = ({
  isOpen,
  isSending,
  onSendingChange,
  onClose,
  onBoardChange,
}: ChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) {
      return;
    }
    setInput("");
    setError("");
    setMessages([...messages, { role: "user", content: message }]);
    onSendingChange(true);
    try {
      const reply = await sendChat(message, messages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply.message }]);
      if (reply.board) {
        onBoardChange(reply.board);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      onSendingChange(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      aria-label="AI chat"
      className="sticky top-0 z-20 flex h-screen w-96 shrink-0 flex-col border-l border-[var(--stroke)] bg-white shadow-[var(--shadow)]"
    >
      <header className="flex items-start justify-between border-b border-[var(--stroke)] p-6">
        <div>
          <div className="h-1.5 w-8 rounded-full bg-[var(--accent-yellow)]" />
          <h2 className="mt-3 font-display text-xl font-semibold text-[var(--navy-dark)]">
            AI Assistant
          </h2>
          <p className="mt-1 text-xs text-[var(--gray-text)]">
            Ask it to create, edit or move cards.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Close
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-6">
        {messages.map((message, index) => (
          <p
            key={index}
            data-testid={`chat-${message.role}`}
            className={
              message.role === "user"
                ? "ml-8 whitespace-pre-wrap rounded-2xl bg-[var(--primary-blue)] px-4 py-2 text-sm text-white"
                : "mr-8 whitespace-pre-wrap rounded-2xl bg-[var(--surface)] px-4 py-2 text-sm text-[var(--navy-dark)]"
            }
          >
            {message.content}
          </p>
        ))}
        {isSending && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Thinking...
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-[var(--stroke)] p-4">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message the assistant"
          aria-label="Chat message"
          className="flex-1 rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={isSending}
          className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
