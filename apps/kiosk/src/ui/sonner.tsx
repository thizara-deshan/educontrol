import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn `sonner`, adapted: dark-only (no next-themes), colours from tokens, H13 defaults
// (bottom, 4 s).
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      duration={4000}
      className="toaster group"
      style={{
        "--normal-bg": "var(--color-surface-2)",
        "--normal-text": "var(--color-text-1)",
        "--normal-border": "var(--color-border-strong)",
        "--border-radius": "var(--radius-btn)",
      }}
      toastOptions={{ classNames: { toast: "font-sans text-button" } }}
      {...props}
    />
  );
}

export { Toaster };
