/* eslint-env worker */
import loadHighs from "highs";
import wasmUrl from "highs/runtime?url";
import { solveSnapshot } from "./solve.mjs";

self.onmessage = async (event) => {
  try {
    self.postMessage({ type: "progress", stage: "loading" });
    const highs = await loadHighs({ locateFile: () => wasmUrl });
    const result = solveSnapshot(highs, event.data, (message) =>
      self.postMessage(message)
    );
    self.postMessage({ type: "complete", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error.message || String(error),
    });
  }
};
