export type RotationMemberLike = {
  userId: string;
  position: number;
};

export function orderedMembers<T extends RotationMemberLike>(members: T[]): T[] {
  return [...members].sort((a, b) => a.position - b.position);
}

export function currentlyOnCall<T extends RotationMemberLike>(
  members: T[],
  currentPointer: number,
): T | null {
  const ordered = orderedMembers(members);
  if (ordered.length === 0) return null;
  const index = ((currentPointer % ordered.length) + ordered.length) % ordered.length;
  return ordered[index] ?? null;
}

export function nextPointer(currentPointer: number, memberCount: number): number {
  if (memberCount <= 0) return 0;
  return (currentPointer + 1) % memberCount;
}

export function isHandoffDue(
  lastHandoffAt: Date,
  handoffIntervalDays: number,
  now: Date,
): boolean {
  const elapsedMs = now.getTime() - lastHandoffAt.getTime();
  return elapsedMs >= handoffIntervalDays * 24 * 60 * 60 * 1000;
}
