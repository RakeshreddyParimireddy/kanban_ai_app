import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/test/boardFixture";
import { mockApi } from "@/test/mockApi";

const openChat = async () => {
  render(<KanbanBoard onLogout={() => {}} onSessionExpired={() => {}} />);
  await screen.findAllByTestId(/column-/i);
  await userEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
};

const send = async (text: string) => {
  await userEvent.type(screen.getByLabelText("Chat message"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

const chatRequests = (fetchMock: ReturnType<typeof mockApi>["fetchMock"]) =>
  fetchMock.mock.calls
    .filter(([url]) => url === "/api/chat")
    .map(([, init]) => JSON.parse(init!.body as string));

describe("ChatSidebar", () => {
  it("shows the user message and the AI reply, sending history", async () => {
    const { fetchMock } = mockApi({ chatReply: { message: "Hi there", board: null } });
    await openChat();
    await send("Hello");
    expect(screen.getByTestId("chat-user")).toHaveTextContent("Hello");
    expect(await screen.findByTestId("chat-assistant")).toHaveTextContent("Hi there");

    await send("Again");
    await screen.findAllByTestId("chat-assistant").then((replies) => expect(replies).toHaveLength(2));
    expect(chatRequests(fetchMock)).toEqual([
      { message: "Hello", history: [] },
      {
        message: "Again",
        history: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
        ],
      },
    ]);
  });

  it("updates the board when the reply includes one, without saving again", async () => {
    const board = structuredClone(initialData);
    board.cards["card-ai"] = { id: "card-ai", title: "From the AI", details: "" };
    board.columns[0].cardIds.push("card-ai");
    const { savedBoards } = mockApi({ chatReply: { message: "Added it", board } });
    await openChat();
    await send("Add a card");

    expect(await within(screen.getByTestId("column-col-backlog")).findByText("From the AI")).toBeInTheDocument();
    expect(savedBoards()).toHaveLength(0);
  });

  it("shows an error when the request fails", async () => {
    mockApi();
    await openChat();
    await send("Hello");
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not respond/i);
  });

  it("closes and reopens with the conversation kept", async () => {
    mockApi({ chatReply: { message: "Hi there", board: null } });
    await openChat();
    await send("Hello");
    await screen.findByTestId("chat-assistant");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByLabelText("Chat message")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
    expect(screen.getByTestId("chat-assistant")).toHaveTextContent("Hi there");
  });

  it("blocks board edits while the AI is replying", async () => {
    let release = () => {};
    const chatGate = new Promise<void>((resolve) => (release = resolve));
    const { savedBoards } = mockApi({ chatReply: { message: "Done", board: null }, chatGate });
    await openChat();
    await send("Hello");

    expect(screen.getByText(/the ai assistant is updating the board/i)).toBeInTheDocument();
    const input = within(screen.getByTestId("column-col-backlog")).getByLabelText("Column title");
    await userEvent.type(input, "X");
    expect(input).toHaveValue("Backlog");
    expect(savedBoards()).toHaveLength(0);

    release();
    await screen.findByTestId("chat-assistant");
    await userEvent.type(input, "X");
    expect(input).toHaveValue("BacklogX");
    await waitFor(() => expect(savedBoards()).toHaveLength(1));
  });

  it("waits for queued saves before sending a chat message", async () => {
    const { fetchMock } = mockApi({ chatReply: { message: "Done", board: null } });
    await openChat();
    await userEvent.type(within(screen.getByTestId("column-col-backlog")).getByLabelText("Column title"), "X");
    await send("Hello");
    await screen.findByTestId("chat-assistant");

    const urls = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);
    expect(urls.indexOf("PUT /api/board")).toBeGreaterThan(-1);
    expect(urls.lastIndexOf("PUT /api/board")).toBeLessThan(urls.indexOf("POST /api/chat"));
  });
});
