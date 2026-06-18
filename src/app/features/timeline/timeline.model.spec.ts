import { buildTimeline, DishEntry } from './timeline.model';

function makeDish(name: string, cookMinutes: number, id = name): DishEntry {
  return { id, name, cookMinutes };
}

describe('buildTimeline', () => {
  const target = new Date('2026-06-18T20:30:00');

  it('returns empty array for empty input', () => {
    expect(buildTimeline([], target)).toEqual([]);
  });

  it('produces one slot for a single dish', () => {
    const slots = buildTimeline([makeDish('Chicken', 35)], target);
    expect(slots.length).toBe(1);
    expect(slots[0].dish.name).toBe('Chicken');
  });

  it('sets startAt = targetTime minus cookMinutes', () => {
    const slots = buildTimeline([makeDish('Rice', 20)], target);
    const expected = new Date(target.getTime() - 20 * 60_000);
    expect(slots[0].startAt.getTime()).toBe(expected.getTime());
  });

  it('all slots start with status pending', () => {
    const slots = buildTimeline([makeDish('A', 10), makeDish('B', 20)], target);
    expect(slots.every(s => s.status === 'pending')).toBe(true);
  });

  it('sorts by cookMinutes descending — longest first', () => {
    const dishes = [makeDish('Salad', 5), makeDish('Chicken', 35), makeDish('Rice', 20)];
    const slots = buildTimeline(dishes, target);
    expect(slots[0].dish.name).toBe('Chicken');
    expect(slots[1].dish.name).toBe('Rice');
    expect(slots[2].dish.name).toBe('Salad');
  });

  it('dishes with equal cookMinutes keep insertion order', () => {
    const dishes = [makeDish('A', 20, 'a'), makeDish('B', 20, 'b'), makeDish('C', 20, 'c')];
    const slots = buildTimeline(dishes, target);
    expect(slots.map(s => s.dish.id)).toEqual(['a', 'b', 'c']);
  });
});
