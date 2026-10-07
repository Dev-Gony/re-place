"use strict";

/**
 * Serializes client-side navigations while retaining only the newest queued URL.
 *
 * Next.js updates the address bar before an App Router transition necessarily
 * commits its server-rendered result. Starting another transition in that
 * interval can leave the newest URL paired with stale page content. Call
 * `request` for every desired URL and `settle` after the active transition has
 * moved from pending back to idle.
 */
class LatestNavigationCoordinator {
  constructor() {
    /** @type {string | null} */
    this.activeHref = null;
    /** @type {string | null} */
    this.queuedHref = null;
  }

  /**
   * @param {string} href
   * @returns {string | null}
   */
  request(href) {
    if (this.activeHref === null) {
      this.activeHref = href;
      return href;
    }

    this.queuedHref = href;
    return null;
  }

  /** @returns {string | null} */
  settle() {
    const completedHref = this.activeHref;
    const nextHref = this.queuedHref;

    this.activeHref = null;
    this.queuedHref = null;

    if (nextHref === null || nextHref === completedHref) return null;

    this.activeHref = nextHref;
    return nextHref;
  }

  /**
   * Settles only after server-rendered filter values confirm the active URL.
   * This remains reliable when the client filter component is remounted while
   * an App Router response commits.
   *
   * @param {string} committedHref
   * @returns {string | null}
   */
  settleCommitted(committedHref) {
    if (this.activeHref !== committedHref) return null;
    return this.settle();
  }
}

module.exports = { LatestNavigationCoordinator };
