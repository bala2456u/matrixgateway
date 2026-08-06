"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { reconcileOrderWithTx, ReconcileError } from "@/lib/reconcile";

export async function approveKyc(profileId: string) {
  const admin = await requireAdmin();
  const profile = await prisma.kycProfile.findUnique({ where: { id: profileId } });
  if (!profile || profile.status !== "PENDING") return;
  await prisma.$transaction([
    prisma.kycProfile.update({
      where: { id: profileId },
      data: { status: "VERIFIED", reviewedAt: new Date(), rejectReason: null },
    }),
    prisma.user.update({ where: { id: profile.userId }, data: { kycStatus: "VERIFIED" } }),
  ]);
  await audit("kyc.approve", { userId: admin.id, detail: profile.userId });
  revalidatePath("/admin/kyc");
}

export async function reconcileOrder(
  reference: string,
  txHash: string
): Promise<{ ok: boolean; error?: string; amount?: string }> {
  const admin = await requireAdmin();
  try {
    const result = await reconcileOrderWithTx(admin.id, reference.trim(), txHash);
    revalidatePath("/admin/orders");
    return { ok: true, amount: result.amount };
  } catch (e) {
    if (e instanceof ReconcileError) return { ok: false, error: e.message };
    throw e;
  }
}

const ADDRESS_PATTERNS: Record<string, RegExp> = {
  TRON: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  EVM: /^0x[0-9a-fA-F]{40}$/,
  SOLANA: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  BITCOIN: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,60}$/,
};

export async function setGatewayWallet(networkId: string, address: string) {
  const admin = await requireAdmin();
  const network = await prisma.assetNetwork.findUnique({ where: { id: networkId }, include: { asset: true } });
  if (!network) return { ok: false, error: "Network not found" };

  const trimmed = address.trim();
  if (trimmed === "") {
    await prisma.assetNetwork.update({ where: { id: networkId }, data: { depositAddress: null } });
    await audit("wallet.clear", { userId: admin.id, detail: `${network.asset.symbol}/${network.code}` });
    revalidatePath("/admin/wallets");
    return { ok: true };
  }

  const pattern = ADDRESS_PATTERNS[network.addressFamily];
  if (pattern && !pattern.test(trimmed)) {
    return { ok: false, error: `That doesn't look like a valid ${network.name} address` };
  }

  await prisma.assetNetwork.update({ where: { id: networkId }, data: { depositAddress: trimmed } });
  await audit("wallet.set", { userId: admin.id, detail: `${network.asset.symbol}/${network.code} → ${trimmed}` });
  revalidatePath("/admin/wallets");
  return { ok: true };
}

export async function rejectKyc(profileId: string, reason: string) {
  const admin = await requireAdmin();
  const profile = await prisma.kycProfile.findUnique({ where: { id: profileId } });
  if (!profile || profile.status !== "PENDING") return;
  const rejectReason = reason.trim() || "Details could not be verified";
  await prisma.$transaction([
    prisma.kycProfile.update({
      where: { id: profileId },
      data: { status: "REJECTED", reviewedAt: new Date(), rejectReason },
    }),
    prisma.user.update({ where: { id: profile.userId }, data: { kycStatus: "REJECTED" } }),
  ]);
  await audit("kyc.reject", { userId: admin.id, detail: `${profile.userId}: ${rejectReason}` });
  revalidatePath("/admin/kyc");
}
