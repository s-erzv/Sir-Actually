import { getBrowserSupabase } from "@/lib/supabase/browser";

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("Sesi tidak ditemukan. Silakan login ulang.");
  }

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${data.session.access_token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(input, { ...init, headers });
}

export async function authJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<T> {
  const response = await authFetch(input, init);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    missing?: string[];
    completeness?: unknown;
  };
  if (!response.ok) {
    const error = new Error(body.error ?? `Permintaan gagal (${response.status}).`);
    Object.assign(error, { status: response.status, body });
    throw error;
  }
  return body;
}
