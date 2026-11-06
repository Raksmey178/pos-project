import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { requirePageStaff } from "@/server/auth/current-staff";
import { hasPermission } from "@/server/auth/permissions";
import { getKitchenBoard } from "@/server/services/kitchen";

export default async function KitchenPage() {
  const staff = await requirePageStaff("kitchen:view");
  const canPrepare = hasPermission(staff.role, "kitchen:prepare");

  return (
    <KitchenBoard
      board={await getKitchenBoard()}
      canPrepare={canPrepare}
      canServe={hasPermission(staff.role, "kitchen:serve")}
      // The kitchen starts on what must be cooked; waiters start on what is ready to carry out.
      defaultView={canPrepare ? "active" : "ready"}
    />
  );
}
