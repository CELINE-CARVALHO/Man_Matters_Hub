export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string[]>) { super(message); }
}

export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Request failed", body.details);
  return body as T;
}
export const fetcher = (url: string) => api<any>(url);
