// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.

/*************************************************************************
 * 0. RUNTIME WATCHDOG, HIGH-RES UNIX CLOCK & 14-POINT SELF-TEST SUITE
 *************************************************************************/
export const TimeStampUtil = {
  nowPacket() {
    const perfMs = performance.now();
    const unixMs = Math.round(performance.timeOrigin + perfMs);
    return {
      unixMs,
      perfNowUs: Math.round(perfMs * 1000),
      iso: new Date(unixMs).toISOString(),
    };
  },
};
