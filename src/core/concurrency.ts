export class ConcurrencyLimiter {
  private activeJobs: number = 0;
  private queue: Array<() => void> = [];
  private maxConcurrent: number;
  private maxQueue: number;

  constructor(maxConcurrent?: number, maxQueue?: number) {
    this.maxConcurrent = maxConcurrent || parseInt(process.env.MAX_CONCURRENT_JOBS || '4', 10);
    this.maxQueue = maxQueue || parseInt(process.env.MAX_QUEUE_WAITING || '10', 10);
  }

  public getStats() {
    return {
      activeJobs: this.activeJobs,
      queuedJobs: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue,
    };
  }

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeJobs >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        const err: any = new Error(
          'Capacidad máxima alcanzada: el servidor está procesando su límite de imágenes concurrentes. Por favor reintente en unos segundos.'
        );
        err.statusCode = 503;
        err.retryAfter = 5;
        throw err;
      }

      // Esperar en cola
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.activeJobs++;

    try {
      return await fn();
    } finally {
      this.activeJobs--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

export const sharpConcurrencyLimiter = new ConcurrencyLimiter();
