import { encode, runTimeline, toTimeline, unitMs } from '@/tools/morse';

describe('encode', () => {
  it('encodes letters and words', () => {
    expect(encode('SOS')).toEqual({ code: '... --- ...', skipped: [] });
    expect(encode('Hi there').code).toBe('.... .. / - .... . .-. .');
  });
  it('folds accents and reports characters without a code', () => {
    expect(encode('é').code).toBe('.');
    expect(encode('a#🆘b')).toEqual({ code: '.- -...', skipped: ['#', '🆘'] });
  });
  it('returns an empty code when nothing is encodable', () => {
    expect(encode('### 漢字')).toEqual({ code: '', skipped: ['#', '漢', '字'] });
    expect(encode('   ').code).toBe('');
  });
});

describe('toTimeline', () => {
  const units = (code: string) => toTimeline(code).reduce((n, s) => n + s.units, 0);
  it('uses standard timing', () => {
    expect(toTimeline('.-')).toEqual([{ on: true, units: 1 }, { on: false, units: 1 }, { on: true, units: 3 }, { on: false, units: 7 }]);
    expect(toTimeline('. .')[1]).toEqual({ on: false, units: 3 });
    expect(toTimeline('. / .')[1]).toEqual({ on: false, units: 7 });
    expect(units('... --- ...')).toBe(34);
  });
  it('is empty for an empty code', () => expect(toTimeline('')).toEqual([]));
});

it('derives the unit from words per minute', () => expect(unitMs(20)).toBe(60));

describe('runTimeline', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const steps = [{ on: true, units: 1 }, { on: false, units: 1 }];

  it('plays once and finishes', () => {
    const onChange = jest.fn();
    const onDone = jest.fn();
    runTimeline(steps, 100, onChange, false, onDone);
    expect(onChange.mock.calls).toEqual([[true]]);
    jest.advanceTimersByTime(100);
    expect(onChange).toHaveBeenLastCalledWith(false);
    jest.advanceTimersByTime(100);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('loops until cancelled', () => {
    const onChange = jest.fn();
    const cancel = runTimeline(steps, 100, onChange, true);
    jest.advanceTimersByTime(200);
    expect(onChange).toHaveBeenLastCalledWith(true);
    cancel();
    expect(onChange).toHaveBeenLastCalledWith(false);
    const calls = onChange.mock.calls.length;
    jest.advanceTimersByTime(1000);
    expect(onChange.mock.calls.length).toBe(calls);
  });

  it('does nothing harmful with an empty timeline', () => {
    const onDone = jest.fn();
    runTimeline([], 100, jest.fn(), true, onDone);
    expect(onDone).toHaveBeenCalled();
  });
});
