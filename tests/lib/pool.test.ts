import { describe, it, expect, afterEach } from 'vitest';
import { runPool, resolveConcurrency, DEFAULT_CONCURRENCY } from '../../src/lib/pool.ts';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('runPool', () => {
  it('returns results in task order, not completion order', async () => {
    const tasks = [
      () => new Promise<number>(r => setTimeout(() => r(1), 20)),
      () => Promise.resolve(2),
      () => new Promise<number>(r => setTimeout(() => r(3), 10)),
    ];
    expect(await runPool(tasks, 3)).toEqual([1, 2, 3]);
  });

  it('never exceeds the limit', async () => {
    let running = 0;
    let peak = 0;
    const tasks = Array.from({ length: 12 }, () => async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise(r => setTimeout(r, 5));
      running--;
    });

    await runPool(tasks, 3);

    expect(peak).toBe(3);
  });

  it('runs concurrently rather than serially', async () => {
    const gate = deferred();
    let started = 0;
    const tasks = Array.from({ length: 4 }, () => async () => {
      started++;
      await gate.promise;
    });

    const pending = runPool(tasks, 4);
    await Promise.resolve();
    expect(started).toBe(4);
    gate.resolve();
    await pending;
  });

  it('rejects with the first failure and schedules no further tasks', async () => {
    const started: number[] = [];
    const tasks = Array.from({ length: 10 }, (_unused, i) => async () => {
      started.push(i);
      await new Promise(r => setTimeout(r, 1));
      if (i === 0) {
        throw new Error('boom');
      }
    });

    await expect(runPool(tasks, 2)).rejects.toThrow('boom');

    // with a limit of 2, task 1 is already in flight when task 0 fails;
    // what must not happen is the pool working through the whole list
    expect(started.length).toBeLessThan(10);
  });

  it('handles an empty task list', async () => {
    expect(await runPool([], 4)).toEqual([]);
  });

  it('treats a limit larger than the task count as the task count', async () => {
    let peak = 0;
    let running = 0;
    const tasks = Array.from({ length: 2 }, () => async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise(r => setTimeout(r, 5));
      running--;
    });

    await runPool(tasks, 100);

    expect(peak).toBe(2);
  });
});

describe('resolveConcurrency', () => {
  afterEach(() => {
    delete process.env.H5P_CONCURRENCY;
  });

  it('defaults when nothing is set', () => {
    expect(resolveConcurrency()).toBe(DEFAULT_CONCURRENCY);
  });

  it('prefers the explicit request over the environment', () => {
    process.env.H5P_CONCURRENCY = '9';
    expect(resolveConcurrency(2)).toBe(2);
  });

  it('falls back to H5P_CONCURRENCY', () => {
    process.env.H5P_CONCURRENCY = '7';
    expect(resolveConcurrency()).toBe(7);
  });

  it('ignores a nonsense environment value', () => {
    process.env.H5P_CONCURRENCY = 'lots';
    expect(resolveConcurrency()).toBe(DEFAULT_CONCURRENCY);
  });

  it('ignores a non-positive request', () => {
    expect(resolveConcurrency(0)).toBe(DEFAULT_CONCURRENCY);
    expect(resolveConcurrency(-3)).toBe(DEFAULT_CONCURRENCY);
  });
});
