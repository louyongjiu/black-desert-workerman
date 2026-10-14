/* eslint-env worker */
import loadHighs from "highs";
import wasmUrl from "highs/runtime?url";
import { solveSnapshot } from "./solve.mjs";
import { optimizerSession } from "./transport.mjs";

const run = optimizerSession(
  () => loadHighs({ locateFile: () => wasmUrl }),
  solveSnapshot
);

self.onmessage = async (event) => {
  const { runId, snapshot } = event.data;
  const emit = (message) => self.postMessage({ ...message, runId });
  try {
    emit({ type: "progress", stage: "loading" });
    const result = await run(snapshot, emit);
    emit({ type: "complete", result });
  } catch (error) {
    emit({
      type: "error",
      message: error.message || String(error),
    });
  }
};
