/* eslint-env worker */
import loadHighs from "highs";
import wasmUrl from "highs/runtime?url";
import { solveHousing } from "./solve.mjs";
const runtime = loadHighs({ locateFile: () => wasmUrl });
self.onmessage = async ({ data }) => {
  try {
    const highs = await runtime;
    const result = solveHousing(highs, data, (r) =>
      self.postMessage({ key: data.key, type: "solution", result: r })
    );
    self.postMessage({ key: data.key, type: "complete", result });
  } catch (error) {
    self.postMessage({ key: data.key, type: "error", message: error.message });
  }
};
