export class ExceptionFilter {
  static handle(error: unknown, context: string): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ExceptionFilter] ${context}: ${message}`);
    // In a real app, this might send to Sentry or show a toast notification
  }
}

export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();
  return function (...args: Parameters<T>): ReturnType<T> {
    const key = args.map(arg => String(arg)).join('|');
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  } as T;
}
