import { arrayMove } from "@dnd-kit/sortable";

/** Move one item to a 1-based position in the list (clamped to valid range). */
export function reorderListByTargetPosition<T extends { _id: string }>(
  list: T[],
  itemId: string,
  targetPosition: number
): T[] | null {
  if (list.length === 0) return null;

  const clamped = Math.max(1, Math.min(list.length, Math.floor(targetPosition) || 1));
  const oldIndex = list.findIndex((item) => item._id === itemId);
  if (oldIndex === -1) return null;

  const newIndex = clamped - 1;
  if (oldIndex === newIndex) return null;

  return arrayMove(list, oldIndex, newIndex);
}
