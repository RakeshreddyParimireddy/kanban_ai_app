import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/test/boardFixture";
import { mockApi } from "@/test/mockApi";

const renderBoard = async () => {
  render(<KanbanBoard onLogout={() => {}} onSessionExpired={() => {}} />);
  await screen.findAllByTestId(/column-/i);
};

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

const lastSaved = async (savedBoards: ReturnType<typeof mockApi>["savedBoards"]) => {
  await waitFor(() => expect(savedBoards().length).toBeGreaterThan(0));
  return savedBoards().at(-1)!;
};

describe("KanbanBoard", () => {
  it("shows loading, then renders the board from the API", async () => {
    mockApi({
      board: {
        columns: [{ id: "col-a", title: "From API", cardIds: ["c1"] }],
        cards: { c1: { id: "c1", title: "API card", details: "d" } },
      },
    });
    render(<KanbanBoard onLogout={() => {}} onSessionExpired={() => {}} />);
    expect(screen.getByText(/loading board/i)).toBeInTheDocument();
    expect(await screen.findByText("API card")).toBeInTheDocument();
    expect(screen.getByLabelText("Column title")).toHaveValue("From API");
    expect(screen.getByText("1 card")).toBeInTheDocument();
  });

  it("renders five columns", async () => {
    mockApi();
    await renderBoard();
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column and saves it", async () => {
    const { savedBoards } = mockApi();
    await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    expect((await lastSaved(savedBoards)).columns[0].title).toBe("New Name");
  });

  it("adds and removes a card and saves each change", async () => {
    const { savedBoards } = mockApi();
    await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();
    const added = await lastSaved(savedBoards);
    const newId = added.columns[0].cardIds.at(-1)!;
    expect(added.cards[newId]).toEqual({ id: newId, title: "New card", details: "Notes" });

    await userEvent.click(within(column).getByRole("button", { name: /delete new card/i }));
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    await waitFor(() => expect(savedBoards()).toHaveLength(2));
    const removed = savedBoards()[1];
    expect(removed.cards[newId]).toBeUndefined();
    expect(removed.columns[0].cardIds).toEqual(initialData.columns[0].cardIds);
  });

  it("edits a card and saves it", async () => {
    const { savedBoards } = mockApi();
    await renderBoard();
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: "Edit Align roadmap themes" }));

    const title = within(card).getByLabelText("Edit title");
    await userEvent.clear(title);
    await userEvent.type(title, "Updated title");
    const details = within(card).getByLabelText("Edit details");
    await userEvent.clear(details);
    await userEvent.type(details, "Updated details");
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));

    expect(within(card).getByText("Updated title")).toBeInTheDocument();
    expect(within(card).getByText("Updated details")).toBeInTheDocument();
    expect(within(card).queryByLabelText("Edit title")).not.toBeInTheDocument();
    expect((await lastSaved(savedBoards)).cards["card-1"]).toEqual({
      id: "card-1",
      title: "Updated title",
      details: "Updated details",
    });
  });

  it("cancels editing a card without saving", async () => {
    const { savedBoards } = mockApi();
    await renderBoard();
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: "Edit Align roadmap themes" }));
    const title = within(card).getByLabelText("Edit title");
    await userEvent.clear(title);
    await userEvent.type(title, "Discarded");
    await userEvent.click(within(card).getByRole("button", { name: /cancel/i }));

    expect(within(card).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(within(card).queryByText("Discarded")).not.toBeInTheDocument();
    expect(savedBoards()).toHaveLength(0);
  });

  it("shows an error when the board can't be loaded", async () => {
    mockApi({ boardStatus: 500 });
    render(<KanbanBoard onLogout={() => {}} onSessionExpired={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/i);
  });

  it("shows an error when a save fails", async () => {
    mockApi({ saveStatus: 500 });
    await renderBoard();
    await userEvent.type(within(getFirstColumn()).getByLabelText("Column title"), "X");
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be saved/i);
  });

  it("reports an expired session when loading or saving gets a 401", async () => {
    mockApi({ boardStatus: 401 });
    const onLoadExpired = vi.fn();
    const { unmount } = render(<KanbanBoard onLogout={() => {}} onSessionExpired={onLoadExpired} />);
    await waitFor(() => expect(onLoadExpired).toHaveBeenCalled());
    unmount();

    mockApi({ saveStatus: 401 });
    const onSaveExpired = vi.fn();
    render(<KanbanBoard onLogout={() => {}} onSessionExpired={onSaveExpired} />);
    await screen.findAllByTestId(/column-/i);
    await userEvent.type(within(getFirstColumn()).getByLabelText("Column title"), "X");
    await waitFor(() => expect(onSaveExpired).toHaveBeenCalled());
  });
});
