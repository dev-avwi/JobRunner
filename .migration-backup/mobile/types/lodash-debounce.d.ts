declare module 'lodash/debounce' {
  interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): ReturnType<T> | undefined;
    cancel(): void;
    flush(): ReturnType<T> | undefined;
  }
  function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: { leading?: boolean; maxWait?: number; trailing?: boolean }
  ): DebouncedFunction<T>;
  export default debounce;
}
