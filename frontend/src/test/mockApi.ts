import type { ChatReply } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";
import { initialData } from "@/test/boardFixture";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Options = { signedIn?: boolean; loginOk?: boolean; board?: BoardData; chatReply?: ChatReply | null };

// Fakes the backend API; chatReply null makes /api/chat fail. Returns the fetch mock and a getter for saved boards.
export const mockApi = ({ signedIn = true, loginOk = true, board = initialData, chatReply = null }: Options = {}) => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url === "/api/me") return signedIn ? json(200, { username: "user" }) : json(401, {});
    if (url === "/api/login") return loginOk ? json(200, { username: "user" }) : json(401, {});
    if (url === "/api/logout") return json(200, { status: "ok" });
    if (url === "/api/board" && method === "GET") return json(200, board);
    if (url === "/api/board" && method === "PUT") return json(200, JSON.parse(init!.body as string));
    if (url === "/api/chat") return chatReply ? json(200, chatReply) : json(502, {});
    throw new Error(`Unexpected request ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const savedBoards = (): BoardData[] =>
    fetchMock.mock.calls
      .filter(([url, init]) => url === "/api/board" && init?.method === "PUT")
      .map(([, init]) => JSON.parse(init!.body as string));

  return { fetchMock, savedBoards };
};
