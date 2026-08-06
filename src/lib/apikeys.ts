import { prisma } from "./db";
import { hashApiKey } from "./ids";

/**
 * Authenticate a public-API request via Authorization: Bearer mg_live_...
 * Legacy rr_live_ keys (pre-rebrand) are still accepted.
 */
export async function apiKeyUser(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+((?:mg|rr)_live_[A-Za-z0-9_-]+)$/);
  if (!match) return null;
  const keyHash = hashApiKey(match[1]);
  const key = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    include: { user: true },
  });
  if (!key) return null;
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { user: key.user, apiKeyId: key.id };
}
