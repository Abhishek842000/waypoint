import "reflect-metadata";
import {
  getFakeJobClock,
  resetCapturedNotificationPosts,
  resetNotificationHttp,
  resetRealtimeBus,
} from "@waypoint/jobs";

if (!process.env.WAYPOINT_JOBS) {
  process.env.WAYPOINT_JOBS = "memory";
}

getFakeJobClock().reset();
resetCapturedNotificationPosts();
resetNotificationHttp();
resetRealtimeBus();
