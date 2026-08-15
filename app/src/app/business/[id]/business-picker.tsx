'use client';

import { useRouter } from 'next/navigation';
import type { Business } from '@/lib/database.types';

/**
 * "Viewing as" in the sidebar, for someone who runs more than one business.
 *
 * Navigates on change rather than needing a separate Go button: choosing a
 * business is the whole intent of touching this control.
 */
export function BusinessPicker({
  businesses,
  currentId,
}: {
  businesses: Business[];
  currentId: string;
}) {
  const router = useRouter();

  return (
    <div className="biz-picker">
      <label htmlFor="biz">Viewing as</label>
      <select
        id="biz"
        value={currentId}
        onChange={(e) => router.push(`/business/${e.target.value}`)}
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
