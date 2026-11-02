import { getTranslations } from "next-intl/server";

export default async function Home() {
  const app = await getTranslations("App");
  const t = await getTranslations("Home");

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-semibold">{app("title")}</h1>
        <p className="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
          {t("status")}
        </p>
      </div>
    </main>
  );
}
