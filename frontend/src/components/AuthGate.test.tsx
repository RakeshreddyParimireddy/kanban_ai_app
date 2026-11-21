import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { mockApi } from "@/test/mockApi";

const signIn = async (password: string) => {
  await userEvent.type(screen.getByLabelText(/username/i), "Rakeshreddy");
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("AuthGate", () => {
  it("shows the login form when not signed in", async () => {
    mockApi({ signedIn: false });
    render(<AuthGate />);
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(screen.queryAllByTestId(/column-/i)).toHaveLength(0);
  });

  it("shows the board when already signed in", async () => {
    mockApi();
    render(<AuthGate />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("shows an error on invalid credentials", async () => {
    mockApi({ signedIn: false, loginOk: false });
    render(<AuthGate />);
    await screen.findByRole("button", { name: /sign in/i });
    await signIn("wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid username or password/i);
    expect(screen.queryAllByTestId(/column-/i)).toHaveLength(0);
  });

  it("signs in and out", async () => {
    const { fetchMock } = mockApi({ signedIn: false });
    render(<AuthGate />);
    await screen.findByRole("button", { name: /sign in/i });
    await signIn("Rakeshreddy123");
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({
        body: JSON.stringify({ username: "Rakeshreddy", password: "Rakeshreddy123" }),
      })
    );

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/logout", expect.anything());
  });
});
