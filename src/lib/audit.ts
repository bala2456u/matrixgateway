import { prisma } from "./db";

export async function audit(action: string, opts?: { userId?: string; detail?: string; ip?: string }) {
  try {
    await prisma.auditLog.create({
      data: { action, userId: opts?.userId, detail: opts?.detail, ip: opts?.ip },
    });
  } catch {
    // auditing must never break the main flow
  }
}
