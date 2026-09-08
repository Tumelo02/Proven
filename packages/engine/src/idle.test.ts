/**
 * Idle expiry decides who gets back into a live session, so the cases that
 * matter most here are the ones where it must say NO: a browser closed and
 * reopened the next day, a missing marker, a forged one. Each of those used to
 * resume the previous person's session on a shared phone.
 *
 * `now` is injected throughout, so nothing here depends on when the suite runs.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { readLastSeen, isIdleExpired, IDLE_LIMIT_MS, IDLE_WARNING_MS } from './idle.ts';

const NOW = new Date('2026-09-08T12:00:00Z').getTime();

describe('idle session expiry', () => {
  test('a session touched a moment ago is still live', () => {
    assert.equal(isIdleExpired(NOW - 60_000, NOW), false);
  });

  test('a session just inside the limit is still live', () => {
    assert.equal(isIdleExpired(NOW - IDLE_LIMIT_MS + 1000, NOW), false);
  });

  test('exactly at the limit is expired, not live', () => {
    assert.equal(isIdleExpired(NOW - IDLE_LIMIT_MS, NOW), true);
  });

  test('closing the browser for a day does not resume the session', () => {
    assert.equal(isIdleExpired(NOW - 24 * 60 * 60 * 1000, NOW), true);
  });

  test('the warning comes before the sign-out, not after', () => {
    assert.ok(IDLE_WARNING_MS < IDLE_LIMIT_MS);
  });
});

describe('reading the activity marker', () => {
  test('a marker written moments ago reads back unchanged', () => {
    assert.equal(readLastSeen(String(NOW - 1000), NOW), NOW - 1000);
  });

  test('a missing marker is treated as expired, never as fresh', () => {
    assert.equal(readLastSeen(undefined, NOW), null);
    assert.equal(readLastSeen(null, NOW), null);
    assert.equal(readLastSeen('', NOW), null);
    assert.equal(isIdleExpired(readLastSeen(undefined, NOW), NOW), true);
  });

  test('a corrupt marker cannot pass for a fresh one', () => {
    assert.equal(readLastSeen('not-a-number', NOW), null);
    assert.equal(readLastSeen('-1', NOW), null);
    assert.equal(readLastSeen('0', NOW), null);
  });

  /* The one that matters: if a future timestamp were accepted, anyone could
     edit this cookie in their browser and hold a session open indefinitely. */
  test('a timestamp from the future cannot postpone expiry', () => {
    assert.equal(readLastSeen(String(NOW + 60 * 60 * 1000), NOW), null);
    assert.equal(isIdleExpired(readLastSeen(String(NOW + 60 * 60 * 1000), NOW), NOW), true);
  });

  test('ordinary clock skew between phone and server is tolerated', () => {
    assert.equal(readLastSeen(String(NOW + 5_000), NOW), NOW + 5_000);
  });
});
