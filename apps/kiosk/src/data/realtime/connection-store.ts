import { createStore } from "@/lib/store";
import type { ConnectionStatus } from "./connection";

/** The page's connection status; written by the ConnectionManager, read by hooks. */
export const connectionStore = createStore<ConnectionStatus>("connecting");
