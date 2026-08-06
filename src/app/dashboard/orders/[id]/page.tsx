import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { advanceOrder, publicOrder } from "@/lib/orders";
import { OrderTracker } from "../../sell/sell-wizard";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage(props: PageProps<"/dashboard/orders/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;

  const owned = await prisma.sellOrder.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) notFound();

  const order = await advanceOrder(id);
  if (!order) notFound();

  const view = {
    ...publicOrder(order),
    id: order.id,
    events: order.events.map((e) => ({ status: e.status as string, message: e.message, at: e.createdAt.toISOString() })),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/orders" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>
      <div className="mt-4">
        <OrderTracker order={view} />
      </div>
    </div>
  );
}
