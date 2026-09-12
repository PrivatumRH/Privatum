import type { ModelLoadingProgress } from "./types";

export const DEFAULT_WASM_MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";

class SmolLM2WasmEngine {
  private generator: any = null;
  private isLoading = false;
  private progressListeners: ((p: ModelLoadingProgress) => void)[] = [];
  private currentProgress: ModelLoadingProgress = { status: "idle" };

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
    return this.generator !== null;
  }

  public isModelLoading(): boolean {
    return this.isLoading;
  }

  /**
   * Initializes and caches the SmolLM2-135M model locally in browser IndexedDB.
   */
  public async init(modelId: string = DEFAULT_WASM_MODEL): Promise<void> {
    if (this.generator) return;
    if (this.isLoading) return;

    this.isLoading = true;
    this.notifyProgress({ status: "loading", progress: 5, text: "Initializing on-device AI runtime..." });

    try {
      // Dynamic import to prevent SSR or bundling issues
      const { pipeline, env } = await import("@huggingface/transformers");

      // Configure browser cache for persistent on-device execution
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Handle environments without SharedArrayBuffer (e.g. desktop WebViews)
      if (typeof window !== "undefined" && !window.crossOriginIsolated) {
        if (env.backends?.onnx?.wasm) {
          (env.backends.onnx.wasm as any).numThreads = 1;
        }
      }

      this.notifyProgress({ status: "downloading", progress: 15, text: "Loading AI model..." });

      this.generator = await pipeline("text-generation", modelId, {
        dtype: "q4",
        progress_callback: (p: any) => {
          if (p && typeof p.progress === "number") {
            const pct = Math.round(p.progress * 100);
            this.notifyProgress({
              status: "downloading",
              progress: Math.min(95, Math.max(15, pct)),
              text: `Downloading AI: ${pct}%`,
            });
          }
        },
      });

      this.notifyProgress({ status: "ready", progress: 100, text: "AI Ready" });
    } catch (err: any) {
      console.warn("[wasmEngine] Could not load in-browser Wasm model:", err);
      this.notifyProgress({
        status: "error",
        text: err?.message || "Local AI model failed to initialize. Fast parser active.",
      });
      this.generator = null;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Generates a completion using local on-device SmolLM2.
   */
  public async generate(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.generator) {
      await this.init();
    }
    if (!this.generator) {
      throw new Error("Local model is not available.");
    }

    const messages = [
      {
        role: "system",
        content:
          systemPrompt ||
          `You are Privatum Assistant, a non-custodial transaction copilot on Robinhood Chain. Current time: ${new Date().toLocaleTimeString()} (${new Date().toLocaleDateString()}). Answer concisely and helpfully. Explain transaction safety facts, address poisoning, and spending guardrails. Never reveal or request private keys.`,
      },
      { role: "user", content: prompt },
    ];

    try {
      const output = await this.generator(messages, {
        max_new_tokens: 150,
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
        if (typeof text === "string") {
          return text;
        }
        return JSON.stringify(text);
      }
      return "";
    } catch (err) {
      console.error("[wasmEngine] Generation error:", err);
      throw err;
    }
  }
}

export const smolLm2Engine = new SmolLM2WasmEngine();
