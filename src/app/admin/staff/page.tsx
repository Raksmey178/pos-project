import { StaffAdmin } from "@/components/staff/staff-admin";
import { requirePageStaff } from "@/server/auth/current-staff";
import { listStaff } from "@/server/services/staff";

export default async function StaffPage() {
  const actor = await requirePageStaff("staff:view"); // others are sent home
  const staff = await listStaff();

  return <StaffAdmin actor={{ id: actor.id, role: actor.role }} staff={staff} />;
}
