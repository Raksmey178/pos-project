import { MenuAdmin } from "@/components/menu/menu-admin";
import { requirePageStaff } from "@/server/auth/current-staff";
import { getMenuAdminData } from "@/server/services/menu";

export default async function MenuAdminPage() {
  await requirePageStaff("menu:manage"); // others are sent home
  return <MenuAdmin data={await getMenuAdminData()} />;
}
