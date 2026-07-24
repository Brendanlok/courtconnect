// Pure logic for ToastStack: which new notifications should pop a transient
// banner, deduped against what's already been seen, capped to a max stack size.
export interface ToastableNotif { id: string; type: string }

export function pickFreshToasts<T extends ToastableNotif>(
  notifications: T[],
  seenIds: Set<string>,
  allowedTypes: Set<string>,
): T[] {
  return notifications.filter(n => !seenIds.has(n.id) && allowedTypes.has(n.type));
}

export function enqueueToasts<T extends ToastableNotif>(current: T[], fresh: T[], maxVisible: number): T[] {
  return [...fresh, ...current].slice(0, maxVisible);
}
