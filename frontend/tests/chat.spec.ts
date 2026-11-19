import { expect, test } from "@playwright/test";
import { signInToBoard } from "./helpers";

test.skip(!process.env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY not set");

test("AI adds a card that appears without reload", async ({ page }) => {
  await signInToBoard(page);
  await page.getByRole("button", { name: "AI Assistant" }).click();
  await page.getByLabel("Chat message").fill("Add a card called Zebra launch to the Backlog column");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("chat-assistant")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("column-col-backlog").getByText("Zebra launch")).toBeVisible();
});
