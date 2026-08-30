import { getApiUrl } from "@/lib/api";

export async function authFetch(path, getToken, options = {}) {
  const token = await getToken();
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw Object.assign(new Error(data?.message || data?.error || "Request failed"), {
      status: response.status,
      data,
    });
  }
  return data;
}