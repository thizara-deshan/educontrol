import "react";

// Lets `style` carry CSS custom properties (e.g. sonner's `--normal-bg`) without casts.
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
