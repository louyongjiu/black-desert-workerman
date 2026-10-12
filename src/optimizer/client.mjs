export class OptimizerClient {
  constructor(makeWorker, update) {
    this.makeWorker = makeWorker;
    this.update = update;
    this.worker = null;
    this.generation = 0;
  }
  start(snapshot) {
    this.stop(false);
    const generation = ++this.generation;
    const worker = this.makeWorker();
    this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (generation !== this.generation) return;
      this.update(data);
      if (data.type === "complete" || data.type === "error") this.stop(false);
    };
    worker.onerror = (event) => {
      if (generation !== this.generation) return;
      this.update({
        type: "error",
        message: event.message || "优化器加载失败，请重试",
      });
      this.stop(false);
    };
    try {
      worker.postMessage(snapshot);
    } catch (error) {
      this.stop(false);
      throw error;
    }
  }
  stop(notify = true) {
    this.generation++;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      if (notify) this.update({ type: "stopped" });
    }
  }
}
