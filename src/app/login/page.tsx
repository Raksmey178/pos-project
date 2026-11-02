import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentStaff } from "@/server/auth/current-staff";
import { listLoginOptions } from "@/server/services/auth";

export default async function LoginPage() {
  if (await getCurrentStaff()) redirect("/");
  const staff = await listLoginOptions();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <LoginForm staff={staff} />
    </main>
  );
}
