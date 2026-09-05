/*
Bounded-concurrency task runner.

Failure semantics match the sequential loop it replaces: the first rejection
propagates and no further tasks are scheduled. Tasks already in flight are not
cancelled - there is no way to abort a running subprocess mid-clone without
leaving a half-written folder behind - so they run to completion while the
rejection is what the caller sees.
*/
export async function runPool<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  if (!tasks.length) {
    return results;
  }
  const size = Math.max(1, Math.min(Math.floor(limit) || 1, tasks.length));
  let next = 0;
  let stopped = false;
  const worker = async (): Promise<void> => {
    while (!stopped) {
      const index = next++;
      if (index >= tasks.length) {
        return;
      }
      try {
        results[index] = await tasks[index]();
      }
      catch (error) {
        stopped = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
  return results;
}

export const DEFAULT_CONCURRENCY = 4;

export const resolveConcurrency = (requested?: number): number => {
  const fromEnv = process.env.H5P_CONCURRENCY ? parseInt(process.env.H5P_CONCURRENCY, 10) : NaN;
  const value = requested ?? (Number.isFinite(fromEnv) ? fromEnv : DEFAULT_CONCURRENCY);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_CONCURRENCY;
};
