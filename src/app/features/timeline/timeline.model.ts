export interface DishEntry {
  id: string;
  name: string;
  cookMinutes: number;
  recipeId?: string;
}

export type SlotStatus = 'pending' | 'alert' | 'started';

export interface TimelineSlot {
  dish: DishEntry;
  startAt: Date;
  status: SlotStatus;
}

export function buildTimeline(dishes: DishEntry[], targetTime: Date): TimelineSlot[] {
  return [...dishes]
    .sort((a, b) => b.cookMinutes - a.cookMinutes)
    .map(dish => ({
      dish,
      startAt: new Date(targetTime.getTime() - dish.cookMinutes * 60_000),
      status: 'pending' as SlotStatus,
    }));
}
