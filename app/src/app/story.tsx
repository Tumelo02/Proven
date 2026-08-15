'use client';

import { useEffect, useState } from 'react';

/**
 * The pitch, told one beat at a time instead of as a paragraph.
 *
 * This is the story as it runs *without* Proven: each beat a month nobody was
 * watching. It ends where most of them end. The product is deliberately not
 * shown here, because the closing line is the turn.
 */
const BEATS = [
  {
    month: 'Month 1',
    score: 85,
    colour: '#4ade80',
    tag: 'Healthy',
    tagBg: 'rgba(74,222,128,.16)',
    title: 'The money lands',
    body: 'The business gets funded and starts strong. Everyone feels confident.',
    note: 'The plan is signed off. The next formal check-in is months away.',
  },
  {
    month: 'Month 3',
    score: 68,
    colour: '#facc15',
    tag: 'Watch',
    tagBg: 'rgba(250,204,21,.16)',
    title: 'The first warning',
    body: 'A supplier issue delays stock and sales dip. The business keeps going, but something has changed.',
    note: 'Nobody outside the business sees it yet.',
  },
  {
    month: 'Month 5',
    score: 41,
    colour: '#fb923c',
    tag: 'At Risk',
    tagBg: 'rgba(251,146,60,.18)',
    title: 'The pattern grows',
    body: 'Costs rise and sales fall for a second month. The business is still operating, so the problem remains largely invisible.',
    note: 'The entrepreneur needs help. The funder needs visibility.',
  },
  {
    month: 'Month 7',
    score: 0,
    colour: '#8b9bb0',
    tag: 'Closed',
    tagBg: 'rgba(139,155,176,.18)',
    title: 'Too late',
    body: 'The funding is gone. The business closes, but nobody can clearly see when intervention could have changed the outcome.',
    note: 'The problem wasn’t that nobody cared. It was that nobody saw it in time.',
    final: true,
  },
] as const;

export function Story() {
  const [active, setActive] = useState(0);
  /* Drives the short fade when the panel content changes. Cleared on a timer
     so the animation can be retriggered by the next click. */
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    if (!swapping) return;
    const t = setTimeout(() => setSwapping(false), 440);
    return () => clearTimeout(t);
  }, [swapping]);

  const beat = BEATS[active]!;
  const isFinal = 'final' in beat && beat.final;

  function show(i: number) {
    if (i === active) return;
    setActive(i);
    setSwapping(true);
  }

  return (
    <div className="story">
      <div className="story-track" role="tablist" aria-label="Business timeline">
        <div className="story-line">
          <span
            className="story-fill"
            style={{ width: `${(active / (BEATS.length - 1)) * 100}%` }}
          />
        </div>

        {BEATS.map((b, i) => (
          <button
            key={b.month}
            className={`beat${i === active ? ' on' : ''}${i < active ? ' done' : ''}`}
            role="tab"
            aria-selected={i === active}
            onClick={() => show(i)}
          >
            <span className="bd" />
            <span className="bm">{b.month}</span>
          </button>
        ))}
      </div>

      <div className={`story-panel${swapping ? ' swap' : ''}${isFinal ? ' closed' : ''}`}>
        <div className="story-score">
          <div className="sscore" style={{ color: beat.colour }}>
            {beat.score}
          </div>
          <div className="sunit">{isFinal ? 'BUSINESS CLOSED' : 'HEALTH SCORE'}</div>
          <div className="sbar">
            <span style={{ width: `${beat.score}%`, background: beat.colour }} />
          </div>
        </div>

        <div className="story-text">
          <div className="stitle">
            {beat.month}, {beat.title}
          </div>
          <div className="sbody">{beat.body}</div>
          <div className="stag" style={{ background: beat.tagBg, color: beat.colour }}>
            {beat.tag}
          </div>
        </div>
      </div>

      <div className={`story-note${swapping ? ' swap' : ''}${isFinal ? ' final' : ''}`}>
        {beat.note}
      </div>
    </div>
  );
}
