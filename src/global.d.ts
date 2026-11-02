import messages from "./messages/km.json";

// Makes t("...") keys type-checked: a typo in a key becomes a build error.
declare module "next-intl" {
  interface AppConfig {
    Locale: "km";
    Messages: typeof messages;
  }
}
