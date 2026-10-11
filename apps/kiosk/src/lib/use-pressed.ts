import { useState } from "react";

/**
 * Pressed state on touch-down (SPEC §2.6, ARCHITECTURE §4.8): spread the result onto the
 * element and style `data-[pressed=true]:` alongside `active:`.
 */
export function usePressed() {
  const [pressed, setPressed] = useState(false);
  const release = (): void => setPressed(false);
  return {
    "data-pressed": pressed,
    onPointerDown: () => setPressed(true),
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: release,
  };
}
