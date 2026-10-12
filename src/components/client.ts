"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data as T;
}

/** Polls a JSON endpoint; tracks clock skew against the server's `serverNow`. */
export function usePoll<T extends { serverNow?: number }>(url: string, ms = 1500) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [skew, setSkew] = useState(0);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const t0 = Date.now();
      const d = await api<T>(url);
      if (!alive.current) return;
      if (d?.serverNow) setSkew(d.serverNow - (t0 + Date.now()) / 2);
      setData(d);
      setError(null);
    } catch (e) {
      if (alive.current) setError({ message: (e as Error).message, status: (e as { status?: number }).status });
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, ms);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [refresh, ms]);

  return { data, error, refresh, skew };
}

export function useNow(skew = 0, ms = 250) {
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + skew), ms);
    return () => clearInterval(id);
  }, [skew, ms]);
  return now;
}
