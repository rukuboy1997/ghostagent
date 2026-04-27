import { useAuth as useClerkAuth, useUser } from "@clerk/react";
import { apiFetch } from "./api";

export function useApiAuth() {
  const { getToken, isSignedIn } = useClerkAuth();
  const { user } = useUser();

  async function authFetch(path, options = {}) {
    const token = await getToken();
    return apiFetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  }

  return { authFetch, isSignedIn, user };
}
