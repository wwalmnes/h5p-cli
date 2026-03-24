/**
 * Helps run process task on all items in parallel.
 *
 * @param arr item container
 * @param process task
 * @param finished callback
 */
const parallel = (arr: any[], process: (index: number, item: any, done: (status: any) => void) => void, finished: (error: null, results: any[]) => void): void => {
  const results: any[] = [];

  const done = function (status: any) {
    results.push(status);
    if (results.length === arr.length) {
      finished(null, results);
    }
  };

  for (let i = 0; i < arr.length; i++) {
    process(i, arr[i], done);
  }
};

export default parallel;
