import type { BoardData } from "@/lib/kanban";

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const getMe = async (): Promise<string | null> => {
  const response = await fetch("/api/me");
  if (!response.ok) {
    return null;
  }
  return (await response.json()).username;
};

export const login = async (username: string, password: string): Promise<boolean> => {
  const response = await post("/api/login", { username, password });
  return response.ok;
};

export const logout = async () => {
  await post("/api/logout");
};

export const getBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  return response.json();
};

// Saves run one after another so the server always ends with the latest board.
let pendingSave: Promise<unknown> = Promise.resolve();

export const saveBoard = (board: BoardData) => {
  const request = pendingSave.then(() =>
    fetch("/api/board", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(board),
    })
  );
  pendingSave = request.catch(() => undefined);
  return request;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatReply = { message: string; board: BoardData | null };

export const sendChat = async (message: string, history: ChatMessage[]): Promise<ChatReply> => {
  const response = await post("/api/chat", { message, history });
  if (!response.ok) {
    throw new Error("The assistant could not respond. Please try again.");
  }
  return response.json();
};
