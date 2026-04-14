const VITE_API_URL = import.meta.env.VITE_API_URL || "";

export function getApiUrl(path) {
  const base = VITE_API_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}
