import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChangePinForm } from "@/components/auth/change-pin-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { requirePageStaff } from "@/server/auth/current-staff";
import { hasPermission } from "@/server/auth/permissions";

export default async function Home() {
  const staff = await requirePageStaff(); // not logged in -> /login
  const app = await getTranslations("App");
  const t = await getTranslations("Home");
  const roles = await getTranslations("Roles");

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 text-center">
      <div>
        <h1 className="text-3xl font-semibold">{app("title")}</h1>
        <p className="mt-4 text-2xl">{t("welcome", { name: staff.name })}</p>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">{t("role", { role: roles(staff.role) })}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/menu"
          className="flex h-14 items-center rounded-2xl bg-zinc-900 px-6 text-lg font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {t("menu")}
        </Link>
        {hasPermission(staff.role, "menu:manage") && (
          <Link
            href="/admin/menu"
            className="flex h-14 items-center rounded-2xl border border-zinc-300 px-6 text-lg font-medium dark:border-zinc-700"
          >
            {t("menuAdmin")}
          </Link>
        )}
        {hasPermission(staff.role, "staff:view") && (
          <Link
            href="/admin/staff"
            className="flex h-14 items-center rounded-2xl border border-zinc-300 px-6 text-lg font-medium dark:border-zinc-700"
          >
            {t("staffAdmin")}
          </Link>
        )}
        <LogoutButton />
      </div>

      <ChangePinForm />
    </main>
  );
}

