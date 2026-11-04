import { FloorPlanView } from "@/components/tables/floor-plan-view";
import { requirePageStaff } from "@/server/auth/current-staff";
import { getFloorPlan } from "@/server/services/tables";

export default async function TablesPage() {
  await requirePageStaff("tables:view");
  return <FloorPlanView plan={await getFloorPlan()} />;
}
