import React, { useState, useRef, useEffect } from "react";
import { Tag, X, Check, FileText } from "lucide-react";
import {
  type TransactionTag,
  TRANSACTION_TAGS,
  getTagConfig,
} from "../lib/transactionTags";

interface TransactionTagChipProps {
  tag?: TransactionTag;
  note?: string;
  editable?: boolean;
  onUpdate?: (newTag: TransactionTag | undefined, newNote: string | undefined) => void;
}

export const TransactionTagChip: React.FC<TransactionTagChipProps> = ({
  tag,
  note,
  editable = false,
  onUpdate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TransactionTag | undefined>(tag);
  const [noteText, setNoteText] = useState(note || "");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedTag(tag);
    setNoteText(note || "");
  }, [tag, note]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(selectedTag, noteText.trim() || undefined);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedTag(undefined);
    setNoteText("");
    if (onUpdate) {
      onUpdate(undefined, undefined);
    }
    setIsOpen(false);
  };

  const currentStyle = getTagConfig(tag);

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {tag && currentStyle ? (
        <button
          type="button"
          onClick={() => editable && setIsOpen(!isOpen)}
          disabled={!editable}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer ${currentStyle.bgClass} ${currentStyle.borderClass} ${currentStyle.textClass} ${
            editable ? "hover:opacity-80" : ""
          }`}
          title={note ? `${tag}: ${note}` : `${tag} (click to edit)`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${currentStyle.dotClass}`} />
          <span>{tag}</span>
          {note && <FileText className="w-2.5 h-2.5 opacity-70" />}
        </button>
      ) : editable ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent hover:border-white/10 transition cursor-pointer"
          title="Add cost-center tag or note"
        >
          <Tag className="w-2.5 h-2.5" />
          <span>+ Tag</span>
        </button>
      ) : null}

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 p-3 rounded-xl bg-[#12141a] border border-white/15 shadow-2xl space-y-3 text-white">
          <div className="flex items-center justify-between pb-1 border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Tag className="w-3 h-3 text-[#B91C3B]" />
              <span>Cost Center & Tag</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 transition cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">
              Select Category
            </label>
            <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
              {TRANSACTION_TAGS.map((t) => {
                const itemStyle = getTagConfig(t);
                const isSelected = selectedTag === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTag(isSelected ? undefined : t)}
                    className={`py-1 px-1.5 rounded text-[11px] font-medium border text-left flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? `${itemStyle?.bgClass} ${itemStyle?.borderClass} ${itemStyle?.textClass}`
                        : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${itemStyle?.dotClass}`} />
                      <span className="truncate">{t}</span>
                    </div>
                    {isSelected && <Check className="w-2.5 h-2.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">
              Internal Note / Memo
            </label>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Q3 contractor stipend"
              className="w-full bg-[#181a23] border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
              maxLength={80}
            />
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-2.5 py-1 rounded-lg bg-[#B91C3B] hover:bg-[#e03d38] text-white text-[11px] font-semibold transition cursor-pointer"
            >
              Save Tag
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
