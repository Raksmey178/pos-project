import { MenuBrowser } from "@/components/menu/menu-browser";
import { requirePageStaff } from "@/server/auth/current-staff";
import { hasPermission } from "@/server/auth/permissions";
import { getOrderableMenu } from "@/server/services/menu";

export default async function MenuPage() {
  const staff = await requirePageStaff("menu:view");
  const menu = await getOrderableMenu();

  return <MenuBrowser menu={menu} canToggleSoldOut={hasPermission(staff.role, "menu:soldout")} />;
}

