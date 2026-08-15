'use client';

/**
 * Save as PDF, and a way back.
 *
 * Hidden when printing, so the buttons never appear in the document itself.
 */
export function PrintButton() {
  return (
    <div className="rep-actions">
      <button type="button" className="btn" onClick={() => window.print()}>
        Save as PDF
      </button>
      <button type="button" className="btn ghost" onClick={() => window.history.back()}>
        Back
      </button>
    </div>
  );
}
