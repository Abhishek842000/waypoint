import { afterEach, describe, expect, it } from "vitest";
import {
  consumeIncidentCreateLimit,
  resetIncidentCreateRateLimits,
} from "../../apps/api/src/modules/incidents/incident-create-rate-limit";

describe("API-key incident create limiter", () => {
  const previous = process.env.INCIDENT_CREATE_RATE_LIMIT;

  afterEach(() => {
    if (previous === undefined) delete process.env.INCIDENT_CREATE_RATE_LIMIT;
    else process.env.INCIDENT_CREATE_RATE_LIMIT = previous;
    resetIncidentCreateRateLimits();
  });

  it("allows up to the limit then rejects without using timers", () => {
    process.env.INCIDENT_CREATE_RATE_LIMIT = "2";
    expect(consumeIncidentCreateLimit("org_a").ok).toBe(true);
    expect(consumeIncidentCreateLimit("org_a").ok).toBe(true);
    expect(consumeIncidentCreateLimit("org_a").ok).toBe(false);
    expect(consumeIncidentCreateLimit("org_b").ok).toBe(true);
  });
});
