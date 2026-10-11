import { z } from "zod";

export const Interlock = z.object({ // R11, Q7
  status: z.enum(["armed", "holding", "bypassed"]),
  rule_text: z.string(),
});

export type Interlock = z.infer<typeof Interlock>;
