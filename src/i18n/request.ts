import { getRequestConfig } from "next-intl/server";

// One language today. To add English later: add src/messages/en.json and
// choose the locale here (cookie, staff setting, ...). No screen needs rewriting
// because screens only ask for keys like t("status"), never for raw text.
export default getRequestConfig(async () => {
  const locale = "km";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
