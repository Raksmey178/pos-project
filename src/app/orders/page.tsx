import { OrdersList } from "@/components/orders/orders-list";
import { requirePageStaff } from "@/server/auth/current-staff";
import { hasPermission } from "@/server/auth/permissions";
import { listOpenOrders } from "@/server/services/orders";

export default async function OrdersPage() {
  const staff = await requirePageStaff("orders:view");
  return <OrdersList orders={await listOpenOrders()} canEdit={hasPermission(staff.role, "orders:edit")} />;
}
