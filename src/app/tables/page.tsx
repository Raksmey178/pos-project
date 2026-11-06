import { FloorPlanView } from "@/components/tables/floor-plan-view";
import { requirePageStaff } from "@/server/auth/current-staff";
import { getFloorPlan } from "@/server/services/tables";
import { hasPermission } from "@/server/auth/permissions";

export default async function TablesPage() {
  const staff = await requirePageStaff("tables:view");
  return <FloorPlanView plan={await getFloorPlan()} canOrder={hasPermission(staff.role, "orders:edit")} />;
}
