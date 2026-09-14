import { applyEscalationStep } from "./escalate";
import { getFakeJobClock } from "./schedule";

export { recordIncidentEvent } from "./events";
export { applyEscalationStep } from "./escalate";
export {
  notifyIncident,
  capturedNotificationPosts,
  resetCapturedNotificationPosts,
  setNotificationHttp,
  resetNotificationHttp,
} from "./notify";
export { onIncidentOpened } from "./open-incident";
export { pageIncidentStep, resolvePagedTarget, scheduleNextEscalation } from "./page-incident";
export { closeJobConnections } from "./queues";
export {
  cancelIncidentEscalation,
  getEscalationScheduler,
  getFakeJobClock,
  scheduleEscalationStep,
  FakeClockScheduler,
} from "./schedule";

if (process.env.NODE_ENV === "test" || process.env.WAYPOINT_JOBS === "memory") {
  getFakeJobClock().setHandler(applyEscalationStep);
}
