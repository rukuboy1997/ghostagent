import { requireAuth, getAuth as clerkGetAuth } from "@clerk/express";

const hasSecretKey = !!process.env.CLERK_SECRET_KEY;

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function requireUser() {
  if (hasSecretKey) {
    return requireAuth();
  }
  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const payload = decodeJwtPayload(token);
    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req._devUserId = payload.sub;
    next();
  };
}

export function getAuth(req) {
  if (hasSecretKey) {
    return clerkGetAuth(req);
  }
  return { userId: req._devUserId };
}
