import { getExpiryStatus } from './inventory.model';

describe('getExpiryStatus', () => {
  const today = () => new Date().toISOString().split('T')[0];
  const daysFromNow = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };

  it('returns none when expiry_date is null', () => {
    expect(getExpiryStatus(null)).toBe('none');
  });

  it('returns expired when past', () => {
    expect(getExpiryStatus(daysFromNow(-1))).toBe('expired');
  });

  it('returns today', () => {
    expect(getExpiryStatus(today())).toBe('today');
  });

  it('returns tomorrow', () => {
    expect(getExpiryStatus(daysFromNow(1))).toBe('tomorrow');
  });

  it('returns this_week for days 2–7', () => {
    expect(getExpiryStatus(daysFromNow(5))).toBe('this_week');
  });

  it('returns later for days > 7', () => {
    expect(getExpiryStatus(daysFromNow(10))).toBe('later');
  });
});
