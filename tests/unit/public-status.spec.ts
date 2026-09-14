import { describe, expect, it } from "vitest";
import {
  PUBLIC_STATUS_INCIDENT_KEYS,
  PUBLIC_STATUS_ORG_KEYS,
  PUBLIC_STATUS_ROOT_KEYS,
  PUBLIC_STATUS_SERVICE_KEYS,
  serviceStatusForSeverity,
  toPublicStatusPayload,
  worstServiceStatus,
} from "@waypoint/shared-types";

describe("service status from incidents", () => {
  it("maps severity onto public service status", () => {
    expect(serviceStatusForSeverity("critical")).toBe("major_outage");
    expect(serviceStatusForSeverity("high")).toBe("partial_outage");
    expect(serviceStatusForSeverity("medium")).toBe("degraded");
    expect(serviceStatusForSeverity("low")).toBe("degraded");
  });

  it("picks the worst of several statuses and operational when empty", () => {
    expect(worstServiceStatus([])).toBe("operational");
    expect(worstServiceStatus(["degraded", "major_outage"])).toBe("major_outage");
  });
});

describe("public status payload allow-list", () => {
  it("drops member names, emails, actor ids, and org internals", () => {
    const org = {
      name: "Acme",
      slug: "acme",
      id: "org_secret",
      ownerEmail: "alice@acme.test",
    };
    const services = [
      {
        id: "svc_1",
        name: "Payments",
        currentStatus: "major_outage" as const,
        orgId: "org_secret",
        webhookUrl: "https://hooks.slack.test/secret",
      },
    ];
    const incidents = [
      {
        id: "inc_1",
        title: "Checkout 500s",
        status: "triggered" as const,
        severity: "critical" as const,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        resolvedAt: null,
        acknowledgedById: "user_alice",
        actorEmail: "alice@acme.test",
        targetLabel: "Alice <alice@acme.test>",
      },
    ];

    const leaked = toPublicStatusPayload({
      org,
      services,
      incidents,
      generatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(Object.keys(leaked).sort()).toEqual([...PUBLIC_STATUS_ROOT_KEYS].sort());
    expect(Object.keys(leaked.org).sort()).toEqual([...PUBLIC_STATUS_ORG_KEYS].sort());
    expect(Object.keys(leaked.services[0]!).sort()).toEqual(
      [...PUBLIC_STATUS_SERVICE_KEYS].sort(),
    );
    expect(Object.keys(leaked.incidents[0]!).sort()).toEqual(
      [...PUBLIC_STATUS_INCIDENT_KEYS].sort(),
    );

    const json = JSON.stringify(leaked);
    expect(json).not.toMatch(/alice@acme\.test/i);
    expect(json).not.toMatch(/user_alice/);
    expect(json).not.toMatch(/org_secret/);
    expect(json).not.toMatch(/hooks\.slack/);
    expect(json).not.toMatch(/targetLabel/);
    expect(json).not.toMatch(/acknowledgedBy/);
    expect(leaked.incidents[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
