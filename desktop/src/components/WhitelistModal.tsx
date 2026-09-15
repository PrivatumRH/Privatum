import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, KeyRound, Plus, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { loadLockConfig, verifyPin } from "../lib/sessionLock";
import { addWhitelistEntry, exportWhitelistJson, importWhitelistJson, loadWhitelist, loadWhitelistConfig, removeWhitelistEntry, saveWhitelistConfig, type WhitelistEntry } from "../lib/transferWhitelist";

interface Props {
  isOpen: boolean;
  initialAddress?: string;
  onClose: () => void;
  onChanged: () => void;
  onRequirePinSetup: () => void;
  onNotify: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

export function WhitelistModal({ isOpen, initialAddress, onClose, onChanged, onRequirePinSetup, onNotify }: Props) {
  const [entries, setEntries] = useState<WhitelistEntry[]>(() => loadWhitelist());
  const [strictMode, setStrictMode] = useState(() => loadWhitelistConfig().strictMode);
  const [adding, setAdding] = useState(false);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const lockConfig = useMemo(() => loadLockConfig(), [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setEntries(loadWhitelist());
    setStrictMode(loadWhitelistConfig().strictMode);
    setAdding(Boolean(initialAddress));
    setAddress(initialAddress || "");
    setLabel(""); setNote(""); setPin(""); setError("");
  }, [isOpen, initialAddress]);

  if (!isOpen) return null;

  const refresh = () => { setEntries(loadWhitelist()); onChanged(); };
  const updateStrictMode = (enabled: boolean) => {
    if (enabled && !lockConfig.hasPin) {
      onNotify("info", "Session PIN Required", "Configure a workstation PIN before enabling strict allowlist mode.");
      onRequirePinSetup();
      return;
    }
    saveWhitelistConfig({ strictMode: enabled });
    setStrictMode(enabled);
    onChanged();
  };
  const add = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    try {
      if (strictMode) {
        if (!lockConfig.pinHash || !lockConfig.pinSalt || !(await verifyPin(pin, lockConfig.pinSalt, lockConfig.pinHash))) {
          setError("Enter your workstation PIN to approve this counterparty."); return;
        }
      }
      addWhitelistEntry({ address, label, note }); refresh(); setAdding(false); setAddress(""); setLabel(""); setNote(""); setPin("");
      onNotify("success", "Counterparty Approved", "This destination is now on the treasury allowlist.");
    } catch (cause: any) { setError(cause?.message || "Could not approve this address."); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportWhitelistJson()], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `privatum-transfer-whitelist-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
  };
  const importFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { importWhitelistJson(String(reader.result)); refresh(); onNotify("success", "Allowlist Imported", "Approved counterparties have been merged."); } catch (cause: any) { onNotify("error", "Import Failed", cause.message); } };
    reader.readAsText(file); event.target.value = "";
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
    <div className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12141a] text-white shadow-2xl">
      <header className="flex items-start justify-between p-6 border-b border-white/[0.08]"><div><div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /><h2 className="font-semibold">Transfer Whitelist</h2><span className="text-[10px] font-mono text-slate-400">v0.1.34</span></div><p className="mt-1 text-xs text-slate-400">Approved counterparties for strict treasury transfers. Separate from your address book.</p></div><button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></header>
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        <section className="rounded-xl border border-white/[0.08] bg-[#181a24] p-4 flex items-center justify-between gap-4"><div><div className="text-xs font-semibold">Strict Allowlist Mode</div><p className="mt-1 text-[11px] text-slate-400">When enabled, only approved direct addresses can receive outgoing transfers.</p></div><button type="button" onClick={() => updateStrictMode(!strictMode)} className={`w-11 h-6 rounded-full p-0.5 transition ${strictMode ? "bg-emerald-500" : "bg-slate-700"}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${strictMode ? "translate-x-5" : ""}`} /></button></section>
        {strictMode && <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100 flex gap-2"><KeyRound className="w-4 h-4 shrink-0 text-amber-400" />New approvals require the workstation PIN.</div>}
        <div className="flex justify-between items-center"><span className="text-xs text-slate-400">{entries.length} approved counterpart{entries.length === 1 ? "y" : "ies"}</span><button onClick={() => setAdding(!adding)} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-black flex gap-1.5"><Plus className="w-3.5 h-3.5" />Approve address</button></div>
        {adding && <form onSubmit={add} className="rounded-xl border border-emerald-500/30 bg-[#181a24] p-4 space-y-3"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x recipient address" className="w-full rounded-lg border border-white/10 bg-[#12141a] p-2 text-xs font-mono" /><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Counterparty label (required)" className="w-full rounded-lg border border-white/10 bg-[#12141a] p-2 text-xs" /><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Audit note (optional)" className="w-full rounded-lg border border-white/10 bg-[#12141a] p-2 text-xs" />{strictMode && <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" placeholder="Workstation PIN required for approval" className="w-full rounded-lg border border-amber-500/30 bg-[#12141a] p-2 text-xs" />}{error && <p className="text-xs text-rose-300">{error}</p>}<button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-black">Confirm approval</button></form>}
        <div className="space-y-2">{entries.length === 0 ? <p className="rounded-xl border border-white/[0.06] p-6 text-center text-xs text-slate-500">No approved counterparties yet.</p> : entries.map((entry) => <div key={entry.address} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#181a24] p-3"><div className="min-w-0"><div className="text-xs font-medium">{entry.label}</div><div className="font-mono text-[11px] text-slate-400 truncate">{entry.address}</div>{entry.note && <div className="text-[11px] text-slate-500">{entry.note}</div>}</div><button onClick={() => { removeWhitelistEntry(entry.address); refresh(); }} className="p-2 text-slate-400 hover:text-rose-300" title="Remove approval"><Trash2 className="w-4 h-4" /></button></div>)}</div>
      </main>
      <footer className="flex items-center justify-between border-t border-white/[0.08] p-4"><div className="flex gap-2"><input ref={fileInput} type="file" accept=".json" onChange={importFile} className="hidden" /><button onClick={() => fileInput.current?.click()} className="text-xs text-slate-300 flex gap-1"><Upload className="w-3.5 h-3.5" />Import</button><button onClick={download} disabled={!entries.length} className="text-xs text-slate-300 disabled:opacity-40 flex gap-1"><Download className="w-3.5 h-3.5" />Export</button></div><button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-2 text-xs">Close</button></footer>
    </div>
  </div>;
}
