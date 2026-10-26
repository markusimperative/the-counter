export interface MonotonicClock { now(): number }

/** Counts visible, unsuspended time only. No narrative or browser dependencies. */
export class ActiveClock {
  private elapsed = 0
  private previous: number
  private suspended = false
  private readonly source: MonotonicClock
  constructor(source: MonotonicClock) { this.source = source; this.previous = source.now() }
  sample(): number {
    const now = this.source.now()
    if (Number.isFinite(now)) {
      if (!this.suspended) this.elapsed += Math.max(0, now - this.previous)
      this.previous = Math.max(this.previous, now)
    }
    return this.elapsed
  }
  setSuspended(suspended: boolean) {
    if (suspended === this.suspended) return
    if (suspended) this.sample()
    else this.previous = this.source.now()
    this.suspended = suspended
  }
}
