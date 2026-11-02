// Thrown for any invalid money input (a bug or bad data), so callers can tell
// it apart from other errors and the app never silently produces a wrong total.
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}
