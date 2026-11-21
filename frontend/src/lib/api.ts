import type { BoardData } from "@/lib/kanban";

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Request failed with status ${status}`);
  }
}

const check = (response: Response) => {
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return response;
};

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// Resolves to null when not signed in or the server can't be reached, so the login form shows.
export const getMe = async (): Promise<string | null> => {
  try {
    const response = await fetch("/api/me");
    return response.ok ? (await response.json()).username : null;
  } catch {
    return null;
  }
};

export const login = async (username: string, password: string): Promise<boolean> => {
  const response = await post("/api/login", { username, password });
  return response.ok;
};

export const logout = async () => {
  await post("/api/logout");
};

export const getBoard = async (): Promise<BoardData> => {
  const response = check(await fetch("/api/board"));
  return response.json();
};

// Saves run one after another so the server always ends with the latest board.
let pendingSave: Promise<unknown> = Promise.resolve();

export const saveBoard = (board: BoardData) => {
  const request = pendingSave
    .then(() =>
      fetch("/api/board", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(board),
      })
    )
    .then(check);
  pendingSave = request.catch(() => undefined);
  return request;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatReply = { message: string; board: BoardData | null };

export const sendChat = async (message: string, history: ChatMessage[]): Promise<ChatReply> => {
  // Let queued saves land first so the AI works from the latest board.
  await pendingSave;
  const response = await post("/api/chat", { message, history });
  if (!response.ok) {
    throw new Error("The assistant could not respond. Please try again.");
  }
  return response.json();
};
