import React from "react";
import { Keyboard, X } from "lucide-react";
import { SHORTCUTS_REGISTRY, ShortcutItem } from "../lib/hotkeys";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: (actionKey: string) => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  onAction,
}) => {
  if (!isOpen) return null;

  const categories: ("Transfers" | "Management" | "General")[] = [
    "Transfers",
    "Management",
    "General",
  ];

  const handleRowClick = (item: ShortcutItem) => {
    if (item.key === "Esc") {
      onClose();
      return;
    }
    if (onAction) {
      onAction(item.key.toLowerCase());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#0e1015] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 text-white select-none max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-400">Terminal quick-navigation and execution hotkeys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition cursor-pointer"
            title="Close cheat sheet (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Grouped Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {categories.map((cat) => {
            const items = SHORTCUTS_REGISTRY.filter((s) => s.category === cat);
            if (items.length === 0) return null;

            return (
              <div key={cat} className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                  {cat}
                </div>
                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      onClick={() => handleRowClick(item)}
                      className="flex items-center justify-between p-3 hover:bg-white/[0.04] transition cursor-pointer text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 pr-4">
                        <div className="font-medium text-white">{item.label}</div>
                        <div className="text-[11px] text-slate-400">{item.description}</div>
                      </div>
                      <div className="shrink-0 flex items-center">
                        <kbd className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white shadow-sm">
                          {item.key}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Hint */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] text-[11px] text-slate-500 shrink-0 font-mono">
          <span>Form safety: Hotkeys are paused while typing in text inputs</span>
          <span>Press Esc to dismiss</span>
        </div>
      </div>
    </div>
  );
};
