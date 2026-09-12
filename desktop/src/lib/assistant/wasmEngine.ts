import type { ModelLoadingProgress } from "./types";

export const DEFAULT_WASM_MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";

class SmolLM2WasmEngine {
  private worker: Worker | null = null;
  private isWorkerReady = false;
  private isLoading = false;
  private progressListeners: ((p: ModelLoadingProgress) => void)[] = [];
  private currentProgress: ModelLoadingProgress = { status: "idle" };
  private pendingRequests = new Map<
    string,
    { resolve: (val: string) => void; reject: (err: any) => void }
  >();
  private reqCounter = 0;

  // Direct generator fallback (for non-browser test environments)
  private directGenerator: any = null;

  public onProgress(listener: (p: ModelLoadingProgress) => void): () => void {
    this.progressListeners.push(listener);
    listener(this.currentProgress);
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== listener);
    };
  }

  private notifyProgress(progress: ModelLoadingProgress) {
    this.currentProgress = progress;
    this.progressListeners.forEach((l) => l(progress));
  }

  public getStatus(): ModelLoadingProgress {
    return this.currentProgress;
  }

  public isReady(): boolean {
    return this.isWorkerReady || this.directGenerator !== null;
  }

  public isModelLoading(): boolean {
    return this.isLoading;
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      return null;
    }

    try {
      this.worker = new Worker(new URL("./assistant.worker.ts", import.meta.url), {
        type: "module",
      });

      this.worker.onmessage = (event: MessageEvent) => {
        const { id, type, status, progress, text, error } = event.data || {};

        if (type === "progress") {
          this.notifyProgress({ status, progress, text });
          if (status === "ready") {
            this.isWorkerReady = true;
            this.isLoading = false;
          } else if (status === "error") {
            this.isLoading = false;
          }
        } else if (type === "init_success") {
          this.isWorkerReady = true;
          this.isLoading = false;
          this.notifyProgress({ status: "ready", progress: 100, text: "AI Ready" });
        } else if (type === "init_error") {
          this.isLoading = false;
          this.notifyProgress({ status: "error", text: error || "Model initialization failed." });
        } else if (type === "generate_success") {
          const pending = this.pendingRequests.get(id);
          if (pending) {
            pending.resolve(text);
            this.pendingRequests.delete(id);
          }
        } else if (type === "generate_error") {
          const pending = this.pendingRequests.get(id);
          if (pending) {
            pending.reject(new Error(error || "Generation error"));
            this.pendingRequests.delete(id);
          }
        }
      };

      this.worker.onerror = (err) => {
        console.warn("[wasmEngine] Worker error:", err);
        this.isLoading = false;
        this.notifyProgress({ status: "error", text: "AI background worker error." });
      };

      return this.worker;
    } catch (err) {
      console.warn("[wasmEngine] Web Worker instantiation failed:", err);
      return null;
    }
  }

  /**
   * Initializes and caches the SmolLM2-135M model on a background Web Worker thread.
   */
  public async init(): Promise<void> {
    if (this.isReady()) return;
    if (this.isLoading) return;

    this.isLoading = true;
    const worker = this.ensureWorker();

    if (worker) {
      this.notifyProgress({ status: "loading", progress: 5, text: "Initializing on-device AI..." });
      worker.postMessage({ type: "init" });
      return;
    }

    // Direct fallback for non-worker test environments
    try {
      this.notifyProgress({ status: "loading", progress: 5, text: "Initializing on-device AI..." });
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      this.directGenerator = await pipeline("text-generation", DEFAULT_WASM_MODEL, {
        dtype: "q4",
      });
      this.notifyProgress({ status: "ready", progress: 100, text: "AI Ready" });
    } catch (err: any) {
      this.notifyProgress({ status: "error", text: err?.message || "Failed to load model." });
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Generates text off-thread in the background Web Worker to ensure zero UI freezes.
   */
  public async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const worker = this.ensureWorker();

    if (worker) {
      const id = `req-${++this.reqCounter}-${Date.now()}`;
      return new Promise<string>((resolve, reject) => {
        this.pendingRequests.set(id, { resolve, reject });
        worker.postMessage({ id, type: "generate", prompt, systemPrompt });

        // Timeout safety (30 seconds)
        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            reject(new Error("AI generation timed out."));
          }
        }, 30000);
      });
    }

    // Direct fallback if worker unavailable
    if (!this.directGenerator) {
      await this.init();
    }
    if (!this.directGenerator) {
      throw new Error("Local model unavailable.");
    }

    const messages = [
      {
        role: "system",
        content:
          systemPrompt ||
          `You are Privatum Assistant, a non-custodial transaction copilot on Robinhood Chain. Current time: ${new Date().toLocaleTimeString()} (${new Date().toLocaleDateString()}). Answer concisely and helpfully. Never reveal or request private keys.`,
      },
      { role: "user", content: prompt },
    ];

    const output = await this.directGenerator(messages, {
      max_new_tokens: 80,
      temperature: 0.2,
      do_sample: false,
      return_full_text: false,
    });

    if (Array.isArray(output) && output[0]?.generated_text) {
      const text = output[0].generated_text;
      if (Array.isArray(text)) {
        const last = text[text.length - 1];
        return last?.content || "";
      }
      return String(text);
    }
    return "";
  }
}

export const smolLm2Engine = new SmolLM2WasmEngine();
