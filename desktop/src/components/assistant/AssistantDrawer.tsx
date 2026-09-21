import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AssistantMessage, EngineMode, ModelLoadingProgress, ParsedIntent } from "../../lib/assistant/types";
import { processAssistantQuery } from "../../lib/assistant/assistantEngine";
import { smolLm2Engine } from "../../lib/assistant/wasmEngine";
import { IntentProposalCard } from "./IntentProposalCard";
import { InferenceReceiptChip } from "./InferenceReceiptChip";
import { generateInferenceReceipt } from "../../lib/assistant/inferenceReceipt";
import { sanitizePromptIngress } from "../../lib/assistant/redactionGateway";
import type { Contact } from "../../lib/contacts";
import type { SpendingGuardrailConfig, SpendingRecord } from "../../lib/spendGuardrails";
import type { OfflineTransaction } from "../../lib/offlineOutbox";
import type { WhitelistEntry, WhitelistConfig } from "../../lib/transferWhitelist";
import type { BlacklistEntry } from "../../lib/transferBlacklist";

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  contacts: Contact[];
  guardrailConfig: SpendingGuardrailConfig;
  spendingHistory: SpendingRecord[];
  transactionHistory: { type: "send" | "receive"; counterparty: string; amount: string; asset: string }[];
  offlineOutbox?: OfflineTransaction[];
  isOnline?: boolean;
  forceAirGap?: boolean;
  confirmedNonce?: number;
  whitelistEntries?: WhitelistEntry[];
  whitelistConfig?: WhitelistConfig;
  blacklistEntries?: BlacklistEntry[];
  onApplyIntent: (intent: ParsedIntent) => void;
  /** Feature gate: inference_receipt_export (0.1.20). */
  receiptExportEnabled?: boolean;
  appVersion?: string;
  /** Signs a receipt bundle digest with the device shard. Key never enters this tree. */
  signDigest?: (digest: string) => Promise<string>;
  recoverSigner?: (digest: string, signature: string) => Promise<string>;
  onNotify?: (kind: "success" | "error" | "info", title: string, message: string) => void;
}

const DEFAULT_SUGGESTION_PROMPTS = [
  "Wallet health report",
  "What is in my outbox?",
  "Show my security policies",
  "How much have I spent today?",
  "Broadcast my queued transfers",
];

export const AssistantDrawer: React.FC<AssistantDrawerProps> = ({
  isOpen,
  onClose,
  walletAddress,
  contacts,
  guardrailConfig,
  spendingHistory,
  transactionHistory,
  offlineOutbox = [],
  isOnline = true,
  forceAirGap = false,
  confirmedNonce = 0,
  whitelistEntries = [],
  whitelistConfig = { strictMode: false },
  blacklistEntries = [],
  onApplyIntent,
  receiptExportEnabled = false,
  appVersion = "0.1.20",
  signDigest,
  recoverSigner,
  onNotify,
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(DEFAULT_SUGGESTION_PROMPTS);
  const [dismissedIntentIds, setDismissedIntentIds] = useState<Set<string>>(new Set());

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

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDismissPrompt = (chip: string) => {
    setSuggestedPrompts((prev) => prev.filter((p) => p !== chip));
  };

  const handleDismissIntent = (msgId: string) => {
    setDismissedIntentIds((prev) => {
      const next = new Set(prev);
      next.add(msgId);
      return next;
    });
  };

  const handleDismissMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

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

    let hasStreamedToken = false;
    const streamMsgId = `stream-${Date.now()}`;

    try {
      const response = await processAssistantQuery({
        input: query,
        walletAddress,
        contacts,
        guardrailConfig,
        spendingHistory,
        transactionHistory,
        offlineOutbox,
        isOnline,
        forceAirGap,
        confirmedNonce,
        whitelistEntries,
        whitelistConfig,
        blacklistEntries,
        preferredEngine: engineMode,
        onToken: (token: string) => {
          if (!hasStreamedToken) {
            hasStreamedToken = true;
            setMessages((prev) => [
              ...prev,
              {
                id: streamMsgId,
                role: "assistant",
                content: token,
                timestamp: Date.now(),
              },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === streamMsgId ? { ...m, content: m.content + token } : m))
            );
          }
        },
      });

      if (hasStreamedToken) {
        setMessages((prev) =>
          prev.map((m) => (m.id === streamMsgId ? response : m))
        );
      } else {
        setMessages((prev) => [...prev, response]);
      }
    } catch (err: any) {
      const errContent = `Assistant error: ${err?.message || "Failed to process query."}`;
      // This catch sits outside the engine's redaction step, so redact again -
      // a throw must never route a raw prompt into a receipt or transcript.
      const errInput = sanitizePromptIngress(query).sanitized;
      const errReceipt = await generateInferenceReceipt(errInput, errContent, "deterministic");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: errContent,
          timestamp: Date.now(),
          inferenceReceipt: errReceipt,
          transcript: { input: errInput, output: errContent },
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
        {/* Header: Pure typography, no badges or sparkles */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm">Privatum Assistant</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Engine Toggle Bar */}
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-xs">
          <span className="text-white/60 font-medium">
            {engineMode === "smollm2_wasm" ? "Local AI" : "Fast Parser"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={engineMode === "smollm2_wasm"}
            onClick={handleToggleWasmEngine}
            className="flex items-center gap-2 text-[11px] text-white/70 hover:text-white transition-colors"
          >
            <span>Enable AI</span>
            <div
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                engineMode === "smollm2_wasm" ? "bg-[#f54842]" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                  engineMode === "smollm2_wasm" ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </div>
          </button>
        </div>

        {/* Model Loading / Status Bar */}
        {engineMode === "smollm2_wasm" && (wasmProgress.status === "loading" || wasmProgress.status === "downloading") && (
          <div className="px-4 py-2 bg-[#f54842]/5 border-b border-[#f54842]/20 text-xs">
            <div className="flex justify-between text-white/60 mb-1 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-[#f54842]" />
                {wasmProgress.text || (wasmProgress.status === "downloading" ? "Downloading AI model..." : "Initializing on-device AI runtime...")}
              </span>
              <span>{wasmProgress.progress ? `${wasmProgress.progress}%` : "5%"}</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#f54842] transition-all duration-300"
                style={{ width: `${wasmProgress.progress || 8}%` }}
              />
            </div>
          </div>
        )}
        {engineMode === "smollm2_wasm" && wasmProgress.status === "ready" && (
          <div className="px-4 py-1.5 bg-emerald-500/5 border-b border-emerald-500/20 text-[11px] text-emerald-400 flex items-center justify-between">
            <span>On-device AI active (SmolLM2-135M)</span>
            <span className="text-[10px] text-emerald-500/60 font-mono">100% offline</span>
          </div>
        )}
        {engineMode === "smollm2_wasm" && wasmProgress.status === "error" && (
          <div className="px-4 py-1.5 bg-amber-500/5 border-b border-amber-500/20 text-[11px] text-amber-300/80 flex items-center justify-between">
            <span>Model unavailable offline. Local Knowledge Base active.</span>
            <button
              type="button"
              onClick={() => smolLm2Engine.init()}
              className="text-[10px] text-amber-400 underline hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {msg.role === "assistant" ? (
                <div className="relative group max-w-[90%] rounded-xl p-3 text-xs leading-relaxed bg-[#161616] text-white/90 border border-white/10">
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/5">
                    <span className="text-[10px] text-white/40 font-mono">Privatum</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissMessage(msg.id)}
                        className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
                        title="Dismiss answer"
                        aria-label="Dismiss answer"
                      >
                        <X className="w-3 h-3" />
                        <span>Dismiss</span>
                      </button>
                    </div>
                  </div>
                  <div className="text-xs leading-relaxed break-words space-y-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:space-y-1 [&_li]:leading-normal [&_strong]:text-white [&_strong]:font-semibold [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_pre]:bg-black/60 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-white/10 [&_pre]:overflow-x-auto">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.inferenceReceipt && (
                    <InferenceReceiptChip
                      receipt={msg.inferenceReceipt}
                      transcript={msg.transcript}
                      appVersion={appVersion}
                      walletAddress={walletAddress}
                      signDigest={signDigest}
                      recoverSigner={recoverSigner}
                      exportEnabled={receiptExportEnabled}
                      onNotify={onNotify}
                    />
                  )}
                </div>
              ) : (
                <div className="group relative max-w-[85%] rounded-xl p-3 text-xs leading-relaxed bg-white text-black font-medium flex items-start gap-2">
                  <span className="flex-1">{msg.content}</span>
                  <button
                    type="button"
                    onClick={() => handleDismissMessage(msg.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-black/40 hover:text-black transition-opacity rounded"
                    title="Dismiss message"
                    aria-label="Dismiss message"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {msg.intent && msg.intent.type !== "general_query" && !dismissedIntentIds.has(msg.id) && (
                <div className="w-full max-w-[90%]">
                  <IntentProposalCard
                    intent={msg.intent}
                    safetyEvidence={msg.safetyEvidence}
                    receipt={msg.inferenceReceipt}
                    onApplyIntent={(it) => {
                      onApplyIntent(it);
                      onClose();
                    }}
                    onDismiss={() => handleDismissIntent(msg.id)}
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
        {suggestedPrompts.length > 0 && (
          <div className="px-4 py-2 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {suggestedPrompts.map((chip) => (
              <div
                key={chip}
                className="group inline-flex items-center bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white rounded-full border border-white/10 transition-colors shrink-0 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleSend(chip)}
                  className="text-[11px] whitespace-nowrap pl-2.5 pr-1.5 py-1 text-left"
                >
                  {chip}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismissPrompt(chip);
                  }}
                  className="p-1 pr-2 text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                  title={`Dismiss "${chip}"`}
                  aria-label={`Dismiss prompt: ${chip}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSuggestedPrompts([])}
              className="text-[10px] text-white/30 hover:text-white/70 px-1.5 py-1 whitespace-nowrap transition-colors"
              title="Dismiss all prompt suggestions"
            >
              Dismiss all
            </button>
          </div>
        )}
        {suggestedPrompts.length === 0 && (
          <div className="px-4 py-1.5 border-t border-white/5 flex justify-end">
            <button
              type="button"
              onClick={() => setSuggestedPrompts(DEFAULT_SUGGESTION_PROMPTS)}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              Restore prompt suggestions
            </button>
          </div>
        )}

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
