import { pipeline, env } from "@huggingface/transformers";

// Configure browser cache for persistent on-device execution
env.allowLocalModels = false;
env.useBrowserCache = true;

// Handle environments without SharedArrayBuffer (e.g. desktop WebViews)
if (typeof crossOriginIsolated === "undefined" || !crossOriginIsolated) {
  if (env.backends?.onnx?.wasm) {
    (env.backends.onnx.wasm as any).numThreads = 1;
  }
}

let generator: any = null;
let isInitializing = false;

const DEFAULT_MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";

async function getGenerator() {
  if (generator) return generator;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return generator;
  }

  isInitializing = true;
  self.postMessage({ type: "progress", status: "loading", progress: 5, text: "Initializing runtime..." });

  try {
    const device = typeof navigator !== "undefined" && (navigator as any).gpu ? "webgpu" : "wasm";

    generator = await pipeline("text-generation", DEFAULT_MODEL, {
      dtype: "q4",
      device,
      progress_callback: (p: any) => {
        if (p && typeof p.progress === "number") {
          const pct = Math.round(p.progress * 100);
          self.postMessage({
            type: "progress",
            status: "downloading",
            progress: Math.min(95, Math.max(15, pct)),
            text: `Downloading AI: ${pct}%`,
          });
        }
      },
    });

    self.postMessage({ type: "progress", status: "ready", progress: 100, text: "AI Ready" });
    return generator;
  } catch (err: any) {
    self.postMessage({ type: "progress", status: "error", text: err?.message || "Model failed to load." });
    throw err;
  } finally {
    isInitializing = false;
  }
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { id, type, prompt, systemPrompt } = event.data || {};

  if (type === "init") {
    try {
      await getGenerator();
      self.postMessage({ id, type: "init_success" });
    } catch (err: any) {
      self.postMessage({ id, type: "init_error", error: err?.message || String(err) });
    }
    return;
  }

  if (type === "generate") {
    try {
      const gen = await getGenerator();
      if (!gen) {
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

      let streamer: any = null;
      try {
        const { TextStreamer } = await import("@huggingface/transformers");
        if (TextStreamer && gen.tokenizer) {
          streamer = new TextStreamer(gen.tokenizer, {
            skip_prompt: true,
            callback_function: (token: string) => {
              self.postMessage({ id, type: "generate_token", token });
            },
          });
        }
      } catch (streamErr) {
        // Fallback to non-streaming output if TextStreamer is not supported
      }

      const output = await gen(messages, {
        max_new_tokens: 80,
        temperature: 0.2,
        do_sample: false,
        return_full_text: false,
        streamer: streamer || undefined,
      });

      let reply = "";
      if (Array.isArray(output) && output[0]?.generated_text) {
        const text = output[0].generated_text;
        if (Array.isArray(text)) {
          const last = text[text.length - 1];
          reply = last?.content || "";
        } else if (typeof text === "string") {
          reply = text;
        } else {
          reply = JSON.stringify(text);
        }
      }

      self.postMessage({ id, type: "generate_success", text: reply.trim() });
    } catch (err: any) {
      self.postMessage({ id, type: "generate_error", error: err?.message || String(err) });
    }
  }
});
