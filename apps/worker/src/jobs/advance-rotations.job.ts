import { ADVANCE_ROTATIONS_JOB } from "@waypoint/shared-types";
import {
  isHandoffDue,
  nextPointer,
} from "@waypoint/shared-types";
import { runWithTenant, tenantDb, unscopedDb } from "@waypoint/db";

export { ADVANCE_ROTATIONS_JOB };

/**
 * Advances every due rotation's round-robin pointer.
 * Called from the BullMQ worker — never from setTimeout in the API process.
 */
export async function advanceDueRotations(now = new Date()): Promise<number> {
  const rotations = await unscopedDb().rotation.findMany({
    include: { members: { orderBy: { position: "asc" } } },
  });

  let advanced = 0;
  for (const rotation of rotations) {
    if (!isHandoffDue(rotation.lastHandoffAt, rotation.handoffIntervalDays, now)) {
      continue;
    }
    if (rotation.members.length === 0) continue;

    const pointer = nextPointer(rotation.currentPointer, rotation.members.length);
    await runWithTenant(rotation.orgId, async () => {
      await tenantDb().rotation.update({
        where: { id: rotation.id },
        data: { currentPointer: pointer, lastHandoffAt: now },
      });
    });
    advanced += 1;
  }
  return advanced;
}

export async function advanceRotationsJob(): Promise<void> {
  const count = await advanceDueRotations();
  if (count > 0) {
    console.log(`[worker] advanced ${count} rotation(s)`);
  }
}
