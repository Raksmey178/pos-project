import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
// Font files are bundled from npm (not downloaded from Google at build time),
// so the app also builds and runs on a restaurant network with no internet.
import "@fontsource-variable/noto-sans-khmer";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App");
  return { title: t("title") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
