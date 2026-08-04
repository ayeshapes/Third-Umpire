/**
 * Thin fetch wrapper for the ThirdUmpire API. Kept dependency-free (no
 * axios) since we only need GET + JSON + AbortSignal for the filter
 * endpoints this powers.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Network error -- check your connection and try again.", 0);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // response wasn't JSON -- fall back to statusText
    }
    throw new ApiError(detail || `Request failed with status ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}
