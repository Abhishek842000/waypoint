import {
  escalationJobId,
  waitMinutesToDelayMs,
  type EscalateIncidentPayload,
} from "@waypoint/shared-types";
import { getEscalateQueue } from "./queues";

export type EscalationScheduler = {
  schedule(payload: EscalateIncidentPayload, delayMs: number): Promise<void>;
  cancel(incidentId: string): Promise<void>;
};

type FakeJob = {
  at: number;
  payload: EscalateIncidentPayload;
};

export class FakeClockScheduler implements EscalationScheduler {
  now = 0;
  jobs: FakeJob[] = [];
  private handler: ((payload: EscalateIncidentPayload) => Promise<unknown>) | null = null;

  setHandler(handler: (payload: EscalateIncidentPayload) => Promise<unknown>) {
    this.handler = handler;
  }

  reset() {
    this.now = 0;
    this.jobs = [];
  }

  async schedule(payload: EscalateIncidentPayload, delayMs: number): Promise<void> {
    this.jobs = this.jobs.filter(
      (job) =>
        !(job.payload.incidentId === payload.incidentId && job.payload.step === payload.step),
    );
    this.jobs.push({ at: this.now + delayMs, payload });
  }

  async cancel(incidentId: string): Promise<void> {
    this.jobs = this.jobs.filter((job) => job.payload.incidentId !== incidentId);
  }

  async elapse(ms: number): Promise<number> {
    this.now += ms;
    return this.flushDue();
  }

  async flushDue(): Promise<number> {
    let ran = 0;
    while (true) {
      const due = this.jobs.filter((job) => job.at <= this.now);
      if (!due.length) break;
      this.jobs = this.jobs.filter((job) => job.at > this.now);
      for (const job of due) {
        if (!this.handler) {
          throw new Error("FakeClockScheduler has no handler — call setHandler(applyEscalationStep)");
        }
        await this.handler(job.payload);
        ran += 1;
      }
    }
    return ran;
  }
}

export class BullmqEscalationScheduler implements EscalationScheduler {
  async schedule(payload: EscalateIncidentPayload, delayMs: number): Promise<void> {
    await getEscalateQueue().add(payload.incidentId, payload, {
      delay: delayMs,
      jobId: escalationJobId(payload.incidentId, payload.step),
      removeOnComplete: true,
      removeOnFail: 50,
    });
    console.log(
      `[jobs] enqueue ${escalationJobId(payload.incidentId, payload.step)} delayMs=${delayMs}`,
    );
  }

  async cancel(incidentId: string): Promise<void> {
    const queue = getEscalateQueue();
    const jobs = await queue.getJobs(["delayed", "waiting", "paused", "prioritized"]);
    await Promise.all(
      jobs
        .filter((job) => job.data.incidentId === incidentId)
        .map((job) => job.remove()),
    );
  }
}

const fakeClock = new FakeClockScheduler();
const bullmq = new BullmqEscalationScheduler();

function useMemoryJobs(): boolean {
  if (process.env.WAYPOINT_JOBS === "bullmq") return false;
  if (process.env.WAYPOINT_JOBS === "memory") return true;
  return process.env.NODE_ENV === "test";
}

export function getEscalationScheduler(): EscalationScheduler {
  return useMemoryJobs() ? fakeClock : bullmq;
}

export function getFakeJobClock(): FakeClockScheduler {
  return fakeClock;
}

export async function scheduleEscalationStep(
  payload: EscalateIncidentPayload,
  waitMinutes: number,
): Promise<void> {
  await getEscalationScheduler().schedule(payload, waitMinutesToDelayMs(waitMinutes));
}

export async function cancelIncidentEscalation(incidentId: string): Promise<void> {
  await getEscalationScheduler().cancel(incidentId);
}

export async function delayedEscalationJobs(incidentId?: string) {
  const jobs = await getEscalateQueue().getDelayed();
  if (!incidentId) return jobs;
  return jobs.filter((job) => job.data.incidentId === incidentId);
}
