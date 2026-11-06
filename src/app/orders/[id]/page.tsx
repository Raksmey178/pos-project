import { notFound } from "next/navigation";
import { z } from "zod";
import { OrderScreen } from "@/components/orders/order-screen";
import { requirePageStaff } from "@/server/auth/current-staff";
import { hasPermission } from "@/server/auth/permissions";
import { ApiError } from "@/server/errors";
import { getOrderableMenu } from "@/server/services/menu";
import { getOrder, listOpenOrders, type OrderView } from "@/server/services/orders";
import { getFloorPlan } from "@/server/services/tables";

export default async function OrderPage(props: PageProps<"/orders/[id]">) {
  const staff = await requirePageStaff("orders:view");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  let order: OrderView;
  try {
    order = await getOrder(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [menu, plan, openOrders] = await Promise.all([getOrderableMenu(), getFloorPlan(), listOpenOrders()]);
  const freeTables = plan.zones.flatMap((zone) =>
    zone.tables.filter((table) => table.status === "AVAILABLE").map((table) => ({ id: table.id, name: table.name, zoneName: zone.name })),
  );
  const mergeCandidates = openOrders.filter((entry) => entry.type === "DINE_IN" && entry.id !== order.id);

  return (
    <OrderScreen
      order={order}
      menu={menu}
      freeTables={freeTables}
      mergeCandidates={mergeCandidates}
      canEdit={hasPermission(staff.role, "orders:edit")}
      canServe={hasPermission(staff.role, "kitchen:serve")}
    />
  );
}
