import type { IrCommand, IrDevice } from "@eduscope/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useReducer } from "react";
import { ApiRequestError } from "@/data/api-client";
import { useApiClient } from "@/data/api-context";
import { inlineErrorStore } from "@/data/commands/inline-errors";
import { useInlineError, useRoomState } from "@/data/hooks";
import { irCaptureStore } from "@/data/ir/capture-store";
import { queryKeys } from "@/data/query-keys";
import { useServerNow } from "@/lib/server-time";
import { useStore } from "@/lib/store";
import { useWritable } from "../shared/use-writable";
import { commandRowView, irErrorMessage, ROW_IDLE, rowReducer, type RowView } from "./command-row";

const ANSWER_FAILED = "Couldn't save the answer · try again";
const errorCode = (error: unknown): string | null => (error instanceof ApiRequestError ? error.code : null);

/** Wires one S3.E14 row to the API, the capture store and the room state. */
export function useCommandRow(command: IrCommand, device: IrDevice) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [local, dispatch] = useReducer(rowReducer, ROW_IDLE);
  const errorKey = `ir:${command.id}`;
  const error = useInlineError(errorKey);
  const capture = useStore(irCaptureStore.entries, (entries) => entries.get(command.id));
  const otherListening = useStore(irCaptureStore.entries, (entries) =>
    [...entries].some(([id, entry]) => id !== command.id && entry.status === "listening"),
  );
  const blasterOnline = useRoomState((state) => state.ir_blaster.online.value === true) ?? false;
  const writable = useWritable();
  const now = useServerNow() ?? new Date();

  const view: RowView = commandRowView({
    command, capture, local, deviceName: device.name, transport: device.transport, blasterOnline, writable, otherListening, now,
  });

  const fail = useCallback((caught: unknown) => inlineErrorStore.show(errorKey, irErrorMessage(errorCode(caught))), [errorKey]);
  const idle = local.kind === "idle";

  const learn = useCallback(async () => {
    if (!idle) return;
    dispatch({ type: "learn" });
    inlineErrorStore.dismiss(errorKey);
    irCaptureStore.dismiss(command.id); // a new attempt replaces "Nothing received"
    try {
      await api.ir.learn(command.id); // progress arrives as `ir_capture` pushes
    } catch (caught) {
      fail(caught);
    }
    dispatch({ type: "done" });
  }, [idle, api, command.id, errorKey, fail]);

  const cancel = useCallback(async () => {
    if (!idle) return;
    dispatch({ type: "cancel" });
    try {
      await api.ir.cancelLearn(command.id);
    } catch (caught) {
      fail(caught);
    }
    dispatch({ type: "done" });
  }, [idle, api, command.id, fail]);

  const test = useCallback(async () => {
    if (!idle) return;
    dispatch({ type: "test" });
    inlineErrorStore.dismiss(errorKey);
    irCaptureStore.dismiss(command.id); // "Captured · now test it" has been answered
    try {
      await api.ir.test(command.id);
      dispatch({ type: "test_sent" });
    } catch (caught) {
      fail(caught);
      dispatch({ type: "done" });
    }
  }, [idle, api, command.id, errorKey, fail]);

  const answer = useCallback(
    async (reacted: boolean) => {
      if (local.kind !== "asking") return;
      dispatch({ type: "answer", reacted });
      try {
        await api.ir.recordTest(command.id, reacted);
        await queryClient.invalidateQueries({ queryKey: queryKeys.irDevices() }); // show the server's new status first
        dispatch({ type: "done" });
      } catch {
        inlineErrorStore.show(errorKey, ANSWER_FAILED);
        dispatch({ type: "answer_failed" });
      }
    },
    [local.kind, api, command.id, errorKey, queryClient],
  );

  return { view, error, learn, cancel, test, answer };
}
