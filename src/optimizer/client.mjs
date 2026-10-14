export class OptimizerClient {
  constructor(makeWorker, update, idleMs = 120000) {
    this.makeWorker = makeWorker;
    this.update = update;
    this.worker = null;
    this.generation = 0;
    this.running = false;
    this.idleMs = idleMs;
    this.idleTimer = null;
  }
  start(snapshot) {
    if (this.running) this.stop(false);
    clearTimeout(this.idleTimer);
    const generation = ++this.generation;
    const worker = this.worker || this.makeWorker();
    this.worker = worker;
    this.running = true;
    worker.onmessage = ({ data }) => {
      if (
        worker !== this.worker ||
        generation !== this.generation ||
        data.runId !== generation ||
        !this.running
      )
        return;
      this.update(data);
      if (data.type === "error") this.stop(false);
      else if (data.type === "complete") {
        this.running = false;
        this.idleTimer = setTimeout(() => {
          if (generation === this.generation && !this.running) this.stop(false);
        }, this.idleMs);
        this.idleTimer.unref?.();
      }
    };
    worker.onerror = (event) => {
      if (worker !== this.worker || generation !== this.generation) return;
      this.update({
        type: "error",
        message: event.message || "优化器加载失败，请重试",
      });
      this.stop(false);
    };
    try {
      worker.postMessage({ runId: generation, snapshot });
    } catch (error) {
      this.stop(false);
      throw error;
    }
  }
  stop(notify = true) {
    this.generation++;
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
    const running = this.running;
    this.running = false;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      if (notify && running) this.update({ type: "stopped" });
    }
  }
}
