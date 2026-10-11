export type HwFixtureTarget =
  | { kind: "event"; schema: "HwEvent"; eventType: string }
  | { kind: "request" | "response"; schema: string };

const pascal = (snake: string): string =>
  snake
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

/** fixtures/README.md "hw file-name → schema rule". */
export function hwFixtureTarget(fileName: string): HwFixtureTarget {
  if (!fileName.endsWith(".json")) {
    throw new Error(`Not a JSON fixture: ${fileName}`);
  }
  const [kind, ...rest] = fileName.slice(0, -".json".length).split(".");
  const [first, second] = rest;
  if (kind === "event" && first !== undefined) {
    return { kind: "event", schema: "HwEvent", eventType: rest.join(".") };
  }
  if (kind === "request" && first !== undefined && second !== undefined && rest.length === 2) {
    return { kind: "request", schema: `Hw${pascal(first)}${pascal(second)}Request` };
  }
  if (kind === "response" && first !== undefined && rest.length <= 2) {
    return { kind: "response", schema: `Hw${pascal(first)}` };
  }
  throw new Error(`Unrecognised hw fixture name: ${fileName}`);
}
