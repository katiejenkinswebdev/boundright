import type { AuthFormState } from "@/app/actions/auth";

export function FormMessage({ state }: { state: AuthFormState }) {
  if (state.status === "idle" || !state.message) return null;
  if (state.status === "ok") {
    return (
      <p role="status" className="text-verify font-medium">
        {state.message}
      </p>
    );
  }
  return (
    <p role="alert" className="text-flag text-sm">
      {state.message}
    </p>
  );
}
