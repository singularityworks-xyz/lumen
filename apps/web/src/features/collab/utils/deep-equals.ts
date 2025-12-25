import { isEqual } from "lodash-es";

// Deep equality check optimized for Kanban entities.
// Uses lodash's isEqual for robust deep comparison that handles
// key order differences, circular references, and edge cases.
export function deepEquals<T>(a: T, b: T): boolean {
  return isEqual(a, b);
}

// Shallow diff to find which keys changed
export function shallowDiff<T extends Record<string, unknown>>(
  prev: T,
  next: T
): Set<keyof T> {
  const changed = new Set<keyof T>();
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    if (prev[key] !== next[key]) {
      changed.add(key as keyof T);
    }
  }

  return changed;
}

// Find added, removed, and changed entities between two EntityMaps
export function diffEntityMaps<T extends { id: string }>(
  prev: Record<string, T>,
  next: Record<string, T>
): {
  added: T[];
  removed: string[];
  changed: T[];
} {
  const added: T[] = [];
  const removed: string[] = [];
  const changed: T[] = [];

  const prevIds = new Set(Object.keys(prev));
  const nextIds = new Set(Object.keys(next));

  // Find added
  for (const id of nextIds) {
    if (!prevIds.has(id)) {
      added.push(next[id] as T);
    }
  }

  // Find removed
  for (const id of prevIds) {
    if (!nextIds.has(id)) {
      removed.push(id);
    }
  }

  // Find changed
  for (const id of prevIds) {
    if (nextIds.has(id) && !deepEquals(prev[id], next[id])) {
      changed.push(next[id] as T);
    }
  }

  return { added, removed, changed };
}
