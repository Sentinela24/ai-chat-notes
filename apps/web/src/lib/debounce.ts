export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Run the pending call now (e.g. before switching notes or unmounting). */
  flush(): void;
  cancel(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const debounced = ((...args: A) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(debounced.flush, ms);
  }) as Debounced<A>;

  debounced.flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      fn(...args);
    }
  };

  debounced.cancel = () => {
    clearTimeout(timer);
    lastArgs = undefined;
  };

  return debounced;
}
