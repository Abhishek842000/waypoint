import "reflect-metadata";
import { getFakeJobClock, resetCapturedNotificationPosts, resetNotificationHttp } from "@waypoint/jobs";

getFakeJobClock().reset();
resetCapturedNotificationPosts();
resetNotificationHttp();
