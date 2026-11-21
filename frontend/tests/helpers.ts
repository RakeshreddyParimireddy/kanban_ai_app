import { expect, type Page } from "@playwright/test";
import { initialData } from "../src/test/boardFixture";

export const signIn = async (page: Page, password = "Rakeshreddy123") => {
  await page.goto("/");
  await page.getByLabel("Username").fill("Rakeshreddy");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

// Signs in via the API, resets the board to the seed data, and opens it.
export const signInToBoard = async (page: Page) => {
  await page.request.post("/api/login", { data: { username: "Rakeshreddy", password: "Rakeshreddy123" } });
  await page.request.put("/api/board", { data: initialData });
  await page.goto("/");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
};

// Runs an action and waits for the board save it triggers.
export const andSave = async (page: Page, action: () => Promise<void>) => {
  const saved = page.waitForResponse(
    (response) => response.url().endsWith("/api/board") && response.request().method() === "PUT"
  );
  await action();
  await saved;
};

export const dragCardToColumn = async (page: Page, cardTestId: string, columnTestId: string) => {
  const cardBox = await page.getByTestId(cardTestId).boundingBox();
  const columnBox = await page.getByTestId(columnTestId).boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 12 });
  await page.mouse.up();
};
