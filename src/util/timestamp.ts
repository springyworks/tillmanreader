/*************************************************************************
 * 0. RUNTIME WATCHDOG, HIGH-RES UNIX CLOCK & 14-POINT SELF-TEST SUITE
 *************************************************************************/

/** One reading of the high-resolution clock in the three formats the telemetry records carry. */
export interface TimePacket {
  /** Wall-clock milliseconds since the Unix epoch. */
  readonly unixMs: number;
  /** `performance.now()` in microseconds. */
  readonly perfNowUs: number;
  /** ISO-8601 UTC rendering of `unixMs`. */
  readonly iso: string;
}

export const TimeStampUtil = {
  nowPacket(): TimePacket {
    const perfMs = performance.now();
    const unixMs = Math.round(performance.timeOrigin + perfMs);
    return {
      unixMs,
      perfNowUs: Math.round(perfMs * 1000),
      iso: new Date(unixMs).toISOString(),
    };
  },
};
