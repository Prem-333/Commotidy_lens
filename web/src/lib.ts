import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
export const symbols = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];
export const colors = ['#e6c66d', '#80b6ec', '#bba4e8', '#6dd4bd'];
export const number = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const money = (value: number) => `₹${number(value)}`;
export const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const usePreferences = create(
  persist<{ theme: 'dark' | 'light'; toggle: () => void }>(
    (set) => ({
      theme: 'light',
      toggle: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'commoditylens-preferences',
      version: 1,
      // Move the previous default to the new light palette once; future choices persist.
      migrate: () => ({ theme: 'light' as const, toggle: () => {} }),
      merge: (persisted, current) => ({
        ...current,
        theme: (persisted as { theme?: string })?.theme === 'dark' ? 'dark' : 'light',
      }),
    },
  ),
);
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${url}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(60000),
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    throw new Error(
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg: string }) => d.msg).join('; ')
          : `Request failed (${response.status})`,
    );
  }
  return response.json();
}
export function csv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    toast.info('No rows to export');
    return;
  }
  const keys = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    let text = value == null ? '' : String(value);
    // Preserve numeric negatives as numbers; escape formula-like strings only.
    if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const content = [keys, ...rows.map((row) => keys.map((key) => row[key]))]
    .map((row) => row.map(escape).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exported');
}
