const VITE_API_URL = import.meta.env.VITE_API_URL || "";

export function getApiUrl(path) {
  const base = VITE_API_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

export async function apiFetch(path, options = {}) {
  const url = getApiUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error || "Request failed"), { status: res.status, data });
  return data;
}
