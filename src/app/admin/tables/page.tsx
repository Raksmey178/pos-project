import { TablesAdmin } from "@/components/tables/tables-admin";
import { requirePageStaff } from "@/server/auth/current-staff";
import { getTablesAdminData } from "@/server/services/tables";

export default async function TablesAdminPage() {
  await requirePageStaff("tables:manage"); // others are sent home
  return <TablesAdmin data={await getTablesAdminData()} />;
}
