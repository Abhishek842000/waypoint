import { expect, test, type Page } from "@playwright/test";

const apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function api<T>(
  page: Page,
  path: string,
  init: { method?: string; body?: unknown; apiKey?: string } = {},
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ url, method, body, apiKey }) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["x-api-key"] = apiKey;
      const res = await fetch(url, {
        method,
        credentials: apiKey ? "omit" : "include",
        headers,
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
      apiKey: init.apiKey,
    },
  );
}

test("core loop: org → invite → service → rotation/policy → API trigger → escalate → ack → resolve → public status", async ({
  page,
}) => {
  const stamp = `${Date.now()}`;
  const orgName = `Acme E2E ${stamp}`;
  const adminEmail = `alice-${stamp}@acme.test`;
  const responderEmail = `riley-${stamp}@acme.test`;

  await page.goto("/register");
  await page.getByLabel("Your name").fill("Alice");
  await page.getByLabel("Work email").fill(adminEmail);
  await page.getByLabel("Password").fill("password123");
  await page.getByLabel("Organization name").fill(orgName);
  await page.getByRole("button", { name: "Create org" }).click();
  await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Name").fill("Riley");
  await page.getByLabel("Email").fill(responderEmail);
  await page.getByLabel("Temporary password").fill("password123");
  await page.getByLabel("Role").selectOption("responder");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByRole("cell", { name: responderEmail })).toBeVisible();

  await page.getByRole("link", { name: "Services" }).click();
  await page.getByPlaceholder("Payments API").fill("Payments API");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByRole("cell", { name: "Payments API" })).toBeVisible();

  await page.getByRole("link", { name: "Rotations" }).click();
  await expect(page.getByRole("heading", { name: "On-call rotations" })).toBeVisible();
  await page.getByLabel("Name").fill("Primary");
  await expect(page.getByRole("button", { name: "Save rotation" })).toBeEnabled();
  await page.getByRole("button", { name: "Save rotation" }).click();
  await expect(page.getByText("On call now:")).toBeVisible();

  await page.getByRole("link", { name: "Policies" }).click();
  await expect(page.getByRole("heading", { name: "Escalation policies" })).toBeVisible();
  await page.getByLabel("Name").fill("Page primary then Riley");
  await expect(page.getByRole("button", { name: "Save policy" })).toBeEnabled();
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByText("Page primary then Riley")).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Create monitor key" }).click();
  const keyText = await page.getByTestId("api-key-plaintext").innerText();
  const apiKey = keyText.match(/wp_live_[A-Za-z0-9_-]+/)?.[0];
  expect(apiKey).toBeTruthy();

  const services = await api<Array<{ id: string; name: string }>>(page, "/v1/services");
  expect(services.status).toBe(200);
  const service = services.body.find((s) => s.name === "Payments API");
  expect(service).toBeTruthy();

  const policies = await api<Array<{ id: string; name: string }>>(page, "/v1/escalation-policies");
  expect(policies.status).toBe(200);
  const policy = policies.body.find((p) => p.name === "Page primary then Riley");
  expect(policy).toBeTruthy();

  const created = await api<{ id: string; status: string }>(page, "/v1/incidents", {
    method: "POST",
    apiKey,
    body: {
      serviceId: service!.id,
      title: "Checkout 500s",
      severity: "critical",
      escalationPolicyId: policy!.id,
    },
  });
  expect(created.status).toBe(201);
  expect(created.body.status).toBe("triggered");

  await expect
    .poll(
      async () => {
        const timeline = await api<Array<{ type: string }>>(
          page,
          `/v1/incidents/${created.body.id}/timeline`,
        );
        return timeline.body.map((e) => e.type);
      },
      { timeout: 90_000 },
    )
    .toContain("escalated");

  await page.getByRole("link", { name: "Incidents" }).click();
  await expect(page.getByRole("link", { name: "Checkout 500s" })).toBeVisible();
  await page.getByRole("link", { name: "Checkout 500s" }).click();
  await expect(page.getByRole("heading", { name: "Checkout 500s" })).toBeVisible();
  await page.getByRole("button", { name: "Acknowledge" }).click();
  await expect(page.getByText(/acknowledged/i).first()).toBeVisible();
  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText(/resolved/i).first()).toBeVisible();

  const publicLink = page.getByRole("link", { name: "Public status" });
  await expect(publicLink).toBeVisible();
  const href = await publicLink.getAttribute("href");
  expect(href).toMatch(/^\/status\//);
  const slug = href!.split("/").pop();

  await expect
    .poll(async () => {
      const status = await api<{
        incidents: Array<{ title: string; status: string }>;
        services: Array<{ currentStatus: string }>;
      }>(page, `/v1/public/status/${slug}`);
      const incident = status.body.incidents.find((i) => i.title === "Checkout 500s");
      return `${incident?.status}:${status.body.services[0]?.currentStatus}`;
    })
    .toBe("resolved:operational");

  await page.goto(href!);
  await expect(page.getByText("Public status")).toBeVisible();
  await expect(page.getByRole("heading", { name: orgName })).toBeVisible();
  await expect(page.getByText("Checkout 500s")).toBeVisible();
  await expect(page.getByText(/resolved/i).first()).toBeVisible();
  await expect(page.getByText(/operational/i).first()).toBeVisible();
});
