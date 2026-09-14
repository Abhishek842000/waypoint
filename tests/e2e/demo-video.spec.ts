import { expect, test, type Page } from "@playwright/test";

const apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Watchable product walkthrough (slowMo + captions). Skipped unless RECORD_DEMO=1
 * so CI stays on the fast core-flow spec.
 */
test.skip(!process.env.RECORD_DEMO, "set RECORD_DEMO=1 to record the demo video");

async function api<T>(
  page: Page,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ url, method, body }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return {
        status: res.status,
        body: (text ? JSON.parse(text) : null) as T,
      };
    },
    {
      url: `${apiURL}${path}`,
      method: init.method ?? "GET",
      body: init.body,
    },
  );
}

async function caption(page: Page, text: string, dwellMs = 1400) {
  await page.evaluate((label) => {
    let el = document.getElementById("wp-demo-caption") as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "wp-demo-caption";
      el.style.cssText = [
        "position:fixed",
        "left:20px",
        "bottom:20px",
        "z-index:2147483647",
        "max-width:min(720px, 78%)",
        "padding:10px 14px",
        "border-radius:10px",
        "background:rgba(4,16,24,0.94)",
        "border:1px solid #2a3441",
        "color:#e7ecf3",
        "font:600 15px/1.35 IBM Plex Sans, system-ui, sans-serif",
        "box-shadow:0 10px 28px rgba(0,0,0,0.4)",
        "pointer-events:none",
      ].join(";");
      document.body.appendChild(el);
    }
    el.textContent = label;
  }, text);
  await page.waitForTimeout(dwellMs);
}

async function typeInto(page: Page, label: string, value: string) {
  const field = page.getByLabel(label);
  await field.click();
  await field.pressSequentially(value, { delay: 28 });
}

test("demo video: register → on-call → incident → escalate → ack → resolve → public status", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const stamp = `${Date.now()}`;
  const orgName = "Acme";
  const adminEmail = `alice-demo-${stamp}@acme.test`;
  const responderEmail = `riley-demo-${stamp}@acme.test`;

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await caption(page, "Waypoint — incident response + public status pages");

  await page.getByRole("link", { name: "Create one" }).click();
  await expect(page.getByRole("heading", { name: "Create organization" })).toBeVisible();
  await caption(page, "1. Register an org. You become the admin of an isolated tenant.", 1200);

  await typeInto(page, "Your name", "Alice Chen");
  await typeInto(page, "Work email", adminEmail);
  await typeInto(page, "Password", "password123");
  await typeInto(page, "Organization name", orgName);
  await caption(page, "Create org — Alice is admin of Acme.", 800);
  await page.getByRole("button", { name: "Create org" }).click();
  await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
  await caption(page, "Empty incident list. Next: invite a responder.");

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await caption(page, "2. Invite Riley as a responder (password invite — no email).", 1000);
  await typeInto(page, "Name", "Riley Park");
  await typeInto(page, "Email", responderEmail);
  await typeInto(page, "Temporary password", "password123");
  await page.getByLabel("Role").selectOption("responder");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByRole("cell", { name: responderEmail })).toBeVisible();
  await caption(page, "Riley is on the org. Next: a service to attach incidents to.");

  await page.getByRole("link", { name: "Services" }).click();
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
  await caption(page, "3. Define a service — this is what the public status page reports.", 1000);
  await page.getByPlaceholder("Payments API").pressSequentially("Payments API", { delay: 28 });
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByRole("cell", { name: "Payments API" })).toBeVisible();
  await caption(page, "Payments API is operational until an incident says otherwise.");

  await page.getByRole("link", { name: "Rotations" }).click();
  await expect(page.getByRole("heading", { name: "On-call rotations" })).toBeVisible();
  await caption(page, "4. On-call rotation: Alice + Riley, weekly handoff.", 1000);
  const nameField = page.getByLabel("Name");
  await nameField.click();
  await nameField.fill("");
  await nameField.pressSequentially("Primary", { delay: 28 });
  await expect(page.getByRole("button", { name: "Save rotation" })).toBeEnabled();
  await page.getByRole("button", { name: "Save rotation" }).click();
  await expect(page.getByText("On call now:")).toBeVisible();
  await caption(page, "Whoever is on call now is step 0 of the policy.");

  await page.getByRole("link", { name: "Policies" }).click();
  await expect(page.getByRole("heading", { name: "Escalation policies" })).toBeVisible();
  await caption(
    page,
    "5. Two-step policy: page the rotation, then escalate to a user. Delay lives in Redis (BullMQ).",
    1600,
  );
  const policyName = page.getByLabel("Name");
  await policyName.click();
  await policyName.fill("");
  await policyName.pressSequentially("Page primary then Riley", { delay: 24 });
  await expect(page.getByRole("button", { name: "Save policy" })).toBeEnabled();
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByText("Page primary then Riley")).toBeVisible();
  await caption(page, "Policy saved. Demo multiplier makes 1 policy-minute ≈ 3 seconds.");

  await page.getByRole("link", { name: "Incidents" }).click();
  await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
  await caption(page, "6. Trigger a critical incident from the dashboard.", 1000);
  await typeInto(page, "Title", "Checkout 500s");
  await page.getByLabel("Severity").selectOption("critical");
  await page.getByLabel("Escalation policy").selectOption({ label: "Page primary then Riley" });
  await page.getByRole("button", { name: "Create incident" }).click();
  await expect(page.getByRole("link", { name: "Checkout 500s" })).toBeVisible();
  await caption(page, "Triggered. Open the timeline — updates arrive over SSE, not a poll.");

  await page.getByRole("link", { name: "Checkout 500s" }).click();
  await expect(page.getByRole("heading", { name: "Checkout 500s" })).toBeVisible();
  await expect(page.getByText("live", { exact: true })).toBeVisible();
  await caption(page, "LIVE connected. Waiting for BullMQ to escalate the unacked incident…", 800);

  const incidentPath = new URL(page.url()).pathname;
  const incidentId = incidentPath.split("/").pop();
  expect(incidentId).toBeTruthy();
  await expect
    .poll(
      async () => {
        const timeline = await api<Array<{ type: string }>>(
          page,
          `/v1/incidents/${incidentId}/timeline`,
        );
        return timeline.body.map((e) => e.type);
      },
      { timeout: 90_000 },
    )
    .toContain("escalated");

  // SSE should paint this without a refresh; reload if the recording browser missed it.
  if (!(await page.getByText("escalated", { exact: true }).isVisible().catch(() => false))) {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Checkout 500s" })).toBeVisible();
  }
  await expect(page.getByText("escalated", { exact: true })).toBeVisible();
  await page.getByText("escalated", { exact: true }).scrollIntoViewIfNeeded();
  await caption(page, "Escalated to the next step. Same IncidentEvent log the API returns.", 1800);

  await page.getByRole("button", { name: "Acknowledge" }).click();
  await expect(page.getByText("acknowledged", { exact: true }).first()).toBeVisible();
  await caption(page, "7. Acknowledged — paging stops. State machine is on the API.", 1600);

  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("resolved", { exact: true }).first()).toBeVisible();
  await caption(page, "8. Resolved. Public status will flip the service back to operational.", 1600);

  const publicLink = page.getByRole("link", { name: "Public status" });
  await expect(publicLink).toBeVisible();
  const href = await publicLink.getAttribute("href");
  expect(href).toMatch(/^\/status\//);

  await page.goto(href!);
  await expect(page.getByText("Public status")).toBeVisible();
  await expect(page.getByRole("heading", { name: orgName })).toBeVisible();
  await expect(page.getByText("Checkout 500s")).toBeVisible();
  await expect(page.getByText(/resolved/i).first()).toBeVisible();
  await expect(page.getByText(/operational/i).first()).toBeVisible();
  await caption(
    page,
    "9. Public status page — no login. Incident is resolved; Payments API is operational.",
    2800,
  );
});
