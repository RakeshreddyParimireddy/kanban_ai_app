import { expect, test } from "@playwright/test";
import { initialData } from "../src/test/boardFixture";
import { dragCardToColumn, signInToBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInToBoard(page);
});

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await dragCardToColumn(page, "card-card-1", "column-col-review");
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
});

test("moves a card into an empty column", async ({ page }) => {
  // Empty "In Progress" by removing its cards, then reload so the board shows it empty.
  const cards = Object.fromEntries(
    Object.entries(initialData.cards).filter(([id]) => id !== "card-4" && id !== "card-5")
  );
  const columns = initialData.columns.map((column) =>
    column.id === "col-progress" ? { ...column, cardIds: [] } : column
  );
  await page.request.put("/api/board", { data: { columns, cards } });
  await page.reload();

  const emptyColumn = page.getByTestId("column-col-progress");
  const dropArea = emptyColumn.getByText("Drop a card here");
  await expect(dropArea).toBeVisible();

  // Drop inside the empty area, level with the first card of the neighbouring Review column.
  // That is where corner-distance collision detection used to pick the neighbour instead.
  const cardBox = await page.getByTestId("card-card-1").boundingBox();
  const dropBox = await dropArea.boundingBox();
  const neighbourBox = await page.getByTestId("card-card-6").boundingBox();
  if (!cardBox || !dropBox || !neighbourBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dropBox.x + dropBox.width / 2, neighbourBox.y + neighbourBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();

  await expect(emptyColumn.getByTestId("card-card-1")).toBeVisible();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toHaveCount(0);
});

test("edits a card", async ({ page }) => {
  const card = page.getByTestId("card-card-2");
  await card.getByRole("button", { name: "Edit Gather customer signals", exact: true }).click();
  await card.getByLabel("Edit title").fill("Edited by e2e");
  await card.getByLabel("Edit details").fill("New details");
  await card.getByRole("button", { name: /save/i }).click();
  await expect(card.getByText("Edited by e2e")).toBeVisible();
  await expect(card.getByText("New details")).toBeVisible();
});

test("deletes a card", async ({ page }) => {
  const column = page.getByTestId("column-col-review");
  await column.getByRole("button", { name: "Delete QA micro-interactions", exact: true }).click();
  await expect(column.getByText("QA micro-interactions")).toHaveCount(0);
});

test("renames a column", async ({ page }) => {
  const input = page.getByTestId("column-col-done").getByLabel("Column title");
  await input.fill("Shipped");
  await expect(input).toHaveValue("Shipped");
});
