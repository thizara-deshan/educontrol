import { isRouteErrorResponse, useRouteError } from "react-router";
import { Card } from "@/components/Card";

/** Route `errorElement`: any render error inside the shell lands here [INFERRED copy]. */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : null;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <Card className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-card-title font-semibold text-text-1">Something went wrong</h1>
        <p className="text-caption text-text-2">Reload the page to continue.</p>
        {detail !== null && <p className="font-mono text-caption text-text-3">{detail}</p>}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-12 rounded-btn border-2 border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125"
        >
          Reload
        </button>
      </Card>
    </main>
  );
}
