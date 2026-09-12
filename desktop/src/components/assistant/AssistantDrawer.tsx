import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Sparkles,
  Bot,
  RotateCw,
  Lock,
  ArrowUpRight,
  Shield,
  Loader2,
  Cpu,
} from "lucide-react";
import type { AssistantMessage, EngineMode, ModelLoadingProgress, ParsedIntent } from "../../lib/assistant/types";
import { processAssistantQuery } from "../../lib/assistant/assistantEngine";
import { smolLm2Engine } from "../../lib/assistant/wasmEngine";
import { IntentProposalCard } from "./IntentProposalCard";
import type { Contact } from "../../lib/contacts";
import type { SpendingGuardrailConfig, SpendingRecord } from "../../lib/spendGuardrails";

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  contacts: Contact[];
  guardrailConfig: SpendingGuardrailConfig;
  spendingHistory: SpendingRecord[];
  transactionHistory: { type: "send" | "receive"; counterparty: string; amount: string; asset: string }[];
  onApplyIntent: (intent: ParsedIntent) => void;
}

export const AssistantDrawer: React.FC<AssistantDrawerProps> = ({
  isOpen,
  onClose,
  walletAddress,
  contacts,
  guardrailConfig,
  spendingHistory,
  transactionHistory,
  onApplyIntent,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Privatum Assistant is active. I can parse transaction commands, check address poisoning, inspect daily guardrails, or summarize risks before you sign. What would you like to do?",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [engineMode, setEngineMode] = useState<EngineMode>("deterministic");
  const [wasmProgress, setWasmProgress] = useState<ModelLoadingProgress>(smolLm2Engine.getStatus());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = smolLm2Engine.onProgress((p) => setWasmProgress(p));
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isProcessing) return;

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsProcessing(true);

    try {
      const response = await processAssistantQuery({
        input: query,
        walletAddress,
        contacts,
        guardrailConfig,
        spendingHistory,
        transactionHistory,
        preferredEngine: engineMode,
      });

      setMessages((prev) => [...prev, response]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Assistant error: ${err?.message || "Failed to process query."}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleWasmEngine = async () => {
    if (engineMode === "deterministic") {
      setEngineMode("smollm2_wasm");
      if (!smolLm2Engine.isReady()) {
        await smolLm2Engine.init();
      }
    } else {
      setEngineMode("deterministic");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0c0c0c] border-l border-white/10 flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f54842]/10 border border-[#f54842]/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#f54842]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm">Privatum Assistant</h3>
                <span className="text-[10px] text-white/40 border border-white/10 px-1.5 py-0.2 rounded font-mono">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-white/40">On-device transaction safety copilot</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Engine Status & Toggle Bar */}
        <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-white/60">
            <Cpu className="w-3.5 h-3.5 text-white/40" />
            <span>Engine:</span>
            <span className="font-medium text-white">
              {engineMode === "deterministic" ? "Deterministic NLP (Fast)" : "SmolLM2-135M (Local Wasm)"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleWasmEngine}
            className="text-[11px] text-[#f54842] hover:text-[#e03e38] transition-colors"
          >
            {engineMode === "deterministic" ? "Enable SmolLM2" : "Use Fast Parser"}
          </button>
        </div>

        {/* Model Loading Progress Bar */}
        {engineMode === "smollm2_wasm" && wasmProgress.status === "downloading" && (
          <div className="px-4 py-2 bg-[#f54842]/5 border-b border-[#f54842]/20 text-xs">
            <div className="flex justify-between text-white/60 mb-1 text-[11px]">
              <span>{wasmProgress.text}</span>
              <span>{wasmProgress.progress}%</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#f54842] transition-all duration-300"
                style={{ width: `${wasmProgress.progress || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-white text-black font-medium"
                    : "bg-[#161616] text-white/90 border border-white/10"
                }`}
              >
                {msg.content}
              </div>

              {msg.intent && (
                <div className="w-full max-w-[90%]">
                  <IntentProposalCard
                    intent={msg.intent}
                    safetyEvidence={msg.safetyEvidence}
                    onApplyIntent={(it) => {
                      onApplyIntent(it);
                      onClose();
                    }}
                  />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f54842]" />
              <span>Analyzing transaction facts...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-white/5 flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            "Send 10 USDG to Alice",
            "Freeze wallet for 24h",
            "What are my spending limits?",
            "Create paylink for 20 USDG",
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSend(chip)}
              className="text-[11px] whitespace-nowrap bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white px-2.5 py-1 rounded-full border border-white/10 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-white/10 bg-[#121212]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type command or question (e.g. send 10 USDG...)"
              className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#f54842] transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="p-2 rounded-lg bg-[#f54842] text-white hover:bg-[#e03e38] disabled:opacity-40 disabled:hover:bg-[#f54842] transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-white/30 text-center mt-2">
            No secrets reach AI. The model never signs or broadcasts transactions.
          </p>
        </div>
      </div>
    </div>
  );
};
