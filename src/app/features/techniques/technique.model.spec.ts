import { calcMastery } from './technique.model';

describe('calcMastery', () => {
  it('F for 0 cooks', () => expect(calcMastery(0, 0)).toBe('F'));
  it('D for 1 cook', () => expect(calcMastery(1, 9)).toBe('D'));
  it('C- for 2 cooks avg 5', () => expect(calcMastery(2, 5)).toBe('C-'));
  it('C for 3 cooks avg 7', () => expect(calcMastery(3, 7)).toBe('C'));
  it('C+ for 4 cooks avg 8', () => expect(calcMastery(4, 8)).toBe('C+'));
  it('B- for 6 cooks avg 5', () => expect(calcMastery(6, 5)).toBe('B-'));
  it('B for 7 cooks avg 8', () => expect(calcMastery(7, 8)).toBe('B'));
  it('B+ for 9 cooks avg 9.5', () => expect(calcMastery(9, 9.5)).toBe('B+'));
  it('A- for 10 cooks avg 8', () => expect(calcMastery(10, 8)).toBe('A-'));
  it('A for 12 cooks avg 9', () => expect(calcMastery(12, 9)).toBe('A'));
  it('A+ for 15 cooks avg 9.5', () => expect(calcMastery(15, 9.5)).toBe('A+'));
});
