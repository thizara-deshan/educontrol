import {
  COLOR_TOKENS, RADIUS_TOKENS, TYPE_TOKENS, type RadiusToken, type TypeToken,
} from "@/styles/token-names";

// Temporary M01 page. M02 replaces it with the router.

// Literal class strings so Tailwind generates them.
const TYPE_CLASS: Record<TypeToken, string> = {
  wordmark: "text-wordmark font-bold",
  clock: "text-clock font-mono font-semibold",
  date: "text-date font-mono text-text-2",
  title: "text-title font-bold",
  section: "text-section font-bold uppercase text-text-2",
  "card-title": "text-card-title font-semibold",
  caption: "text-caption text-text-2",
  button: "text-button font-semibold",
  value: "text-value font-mono font-semibold",
  "sensor-label": "text-sensor-label font-bold uppercase text-text-2",
};

const TYPE_SAMPLE: Record<TypeToken, string> = {
  wordmark: "eduscope",
  clock: "10:42",
  date: "Mon 5 Oct",
  title: "Zigbee devices",
  section: "Display",
  "card-title": "Projector",
  caption: "On · confirmed by draw",
  button: "Power on",
  value: "287 W",
  "sensor-label": "Temperature",
};

const RADIUS_CLASS: Record<RadiusToken, string> = {
  card: "rounded-card",
  btn: "rounded-btn",
  chip: "rounded-chip",
};

export function TokenSwatches() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-wordmark font-bold">
          eduscope <span className="tracking-wordmark text-brand">CENTRAL</span>
        </h1>
        <p className="text-caption text-text-2">Design tokens · temporary M01 page</p>
      </header>

      <section aria-labelledby="tokens-colour" className="mt-8">
        <h2 id="tokens-colour" className="text-section font-bold uppercase text-text-2">Colour</h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {COLOR_TOKENS.map((name) => (
            <li key={name} className="rounded-card border border-border bg-surface p-3">
              <div
                className="h-12 rounded-btn border border-border-strong"
                style={{ backgroundColor: `var(--color-${name})` }}
              />
              <p className="mt-2 break-all font-mono text-caption text-text-1">{name}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tokens-type" className="mt-8">
        <h2 id="tokens-type" className="text-section font-bold uppercase text-text-2">Typography</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="text-caption text-text-2">font-sans · Inter Variable</p>
            <p className="mt-1 font-sans text-card-title">Lecturer microphone 0123456789</p>
          </div>
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="text-caption text-text-2">font-mono · JetBrains Mono Variable</p>
            <p className="mt-1 font-mono text-card-title">10:42 · 287 W · R-101 · LQI 214</p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-surface">
          {TYPE_TOKENS.map((name) => (
            <li
              key={name}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:justify-between"
            >
              <span className={TYPE_CLASS[name]}>{TYPE_SAMPLE[name]}</span>
              <span className="font-mono text-caption text-text-3">text-{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tokens-radius" className="mt-8">
        <h2 id="tokens-radius" className="text-section font-bold uppercase text-text-2">Radius</h2>
        <ul className="mt-3 grid grid-cols-3 gap-3">
          {RADIUS_TOKENS.map((name) => (
            <li key={name} className="flex flex-col items-center gap-2">
              <div className={`h-16 w-full border-2 border-accent-border bg-accent-fill ${RADIUS_CLASS[name]}`} />
              <span className="font-mono text-caption text-text-2">rounded-{name}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
