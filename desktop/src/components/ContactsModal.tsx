import { useState, useMemo } from "react";
import {
  X,
  BookUser,
  Search,
  Plus,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Trash2,
  Edit2,
  Download,
  Upload,
  Check,
  Star,
} from "lucide-react";
import {
  type Contact,
  type ContactCategory,
  addContact,
  updateContact,
  toggleStarContact,
  deleteContact,
  searchContacts,
  saveContacts,
} from "../lib/contacts";

interface ContactsModalProps {
  walletAddress: string;
  contacts: Contact[];
  isOpen: boolean;
  onClose: () => void;
  onContactsChange: (updated: Contact[]) => void;
  onSelectSend?: (address: string) => void;
  addToast: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

const CATEGORIES: (ContactCategory | "All" | "Starred")[] = [
  "All",
  "Starred",
  "Personal",
  "Work",
  "Exchange",
  "Cold Storage",
  "Other",
];

export function ContactsModal({
  walletAddress,
  contacts,
  isOpen,
  onClose,
  onContactsChange,
  onSelectSend,
  addToast,
}: ContactsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ContactCategory | "All" | "Starred">("All");

  // Form states (adding or editing)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCategory, setFormCategory] = useState<ContactCategory>("Personal");
  const [formNote, setFormNote] = useState("");
  const [formIsStarred, setFormIsStarred] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    return searchContacts(contacts, searchQuery, selectedCategory);
  }, [contacts, searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const openAddForm = () => {
    setEditingId(null);
    setFormName("");
    setFormAddress("");
    setFormCategory("Personal");
    setFormNote("");
    setFormIsStarred(false);
    setIsFormOpen(true);
  };

  const openEditForm = (contact: Contact) => {
    setEditingId(contact.id);
    setFormName(contact.name);
    setFormAddress(contact.address);
    setFormCategory(contact.category || "Personal");
    setFormNote(contact.note || "");
    setFormIsStarred(Boolean(contact.isStarred));
    setIsFormOpen(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAddress.trim()) {
      addToast("error", "Invalid Input", "Please provide both a name and an address.");
      return;
    }

    if (editingId) {
      const updated = updateContact(walletAddress, editingId, {
        name: formName,
        address: formAddress,
        category: formCategory,
        note: formNote,
        isStarred: formIsStarred,
      });
      onContactsChange(updated);
      addToast("success", "Contact Updated", `Saved changes to ${formName.trim()}`);
    } else {
      const newContact = addContact(walletAddress, {
        name: formName,
        address: formAddress,
        category: formCategory,
        note: formNote,
        isStarred: formIsStarred,
      });
      onContactsChange([newContact, ...contacts]);
      addToast("success", "Contact Added", `Added ${formName.trim()} to address book`);
    }

    setIsFormOpen(false);
  };

  const handleDeleteContact = (id: string, name: string) => {
    const updated = deleteContact(walletAddress, id);
    onContactsChange(updated);
    addToast("info", "Contact Removed", `Removed ${name} from address book`);
  };

  const handleCopy = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    addToast("success", "Address Copied", "Address copied to clipboard");
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(contacts, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `privatum-contacts-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast("success", "Contacts Exported", "Address book backup downloaded");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          saveContacts(walletAddress, parsed);
          onContactsChange(parsed);
          addToast("success", "Contacts Imported", `Loaded ${parsed.length} contacts`);
        } else {
          addToast("error", "Import Error", "Invalid JSON contacts format");
        }
      } catch {
        addToast("error", "Import Error", "Failed to parse file");
      }
    };
    reader.readAsText(file);
  };

  const shortenAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0e1015] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 text-white select-none max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
              <BookUser className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">Private Address Book</h3>
              <p className="text-xs text-slate-400">Local counterparty directory with zero cloud leaks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isFormOpen && (
              <button
                onClick={openAddForm}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add / Edit Form */}
        {isFormOpen ? (
          <form onSubmit={handleSaveContact} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                {editingId ? "Edit Contact" : "New Contact"}
              </span>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Name / Label</label>
                <input
                  type="text"
                  required
                  placeholder="Alice (Payroll)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as ContactCategory)}
                  className="w-full px-3 py-2 bg-[#181a23] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  <option value="Personal">Personal</option>
                  <option value="Work">Work</option>
                  <option value="Exchange">Exchange</option>
                  <option value="Cold Storage">Cold Storage</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-medium">
                Address (EVM 0x or Stealth st:eth:...)
              </label>
              <input
                type="text"
                required
                placeholder="0x... or st:eth:0x..."
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-medium">Private Note (Optional)</label>
              <input
                type="text"
                placeholder="Contractor payments, invoice reference, etc."
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={formIsStarred}
                onChange={(e) => setFormIsStarred(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-amber-400 focus:ring-0 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Star className={`w-3.5 h-3.5 ${formIsStarred ? "text-amber-400 fill-amber-400" : "text-slate-400"}`} />
                <span>Mark as Starred (Quick-Pay shelf favorite)</span>
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium bg-white text-black rounded-lg hover:bg-slate-200 transition"
              >
                {editingId ? "Save Changes" : "Create Contact"}
              </button>
            </div>
          </form>
        ) : null}

        {/* Search & Category Filter */}
        <div className="space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, address, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg border transition text-xs cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? "bg-white text-black font-medium border-white"
                    : "bg-white/[0.02] text-slate-400 border-white/[0.06] hover:bg-white/5 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {filteredContacts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-2">
              <BookUser className="w-8 h-8 text-slate-600 mx-auto" />
              <div>No contacts found.</div>
              {contacts.length === 0 && (
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Add your frequent counterparties, cold storage vaults, or exchanges to send payments quickly.
                </p>
              )}
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] transition group text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-slate-300 shrink-0">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white truncate">{contact.name}</span>
                      {contact.isStarred && (
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                      {contact.category && (
                        <span className="text-[10px] font-mono text-slate-500">
                          ({contact.category})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-slate-400 text-[11px]">
                      <span>{shortenAddress(contact.address)}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(contact.id, contact.address)}
                        className="text-slate-500 hover:text-white transition"
                        title="Copy address"
                      >
                        {copiedId === contact.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      {!contact.address.startsWith("st:") && (
                        <a
                          href={`https://robinhoodchain.blockscout.com/address/${contact.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-white transition"
                          title="View on Explorer"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    {contact.note && (
                      <div className="text-[11px] text-slate-400 italic truncate">
                        {contact.note}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = toggleStarContact(walletAddress, contact.id);
                      onContactsChange(updated);
                      addToast(
                        "info",
                        contact.isStarred ? "Contact Unstarred" : "Contact Starred",
                        `${contact.name} ${contact.isStarred ? "removed from" : "added to"} favorites`
                      );
                    }}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      contact.isStarred
                        ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                        : "text-slate-500 hover:text-white hover:bg-white/5"
                    }`}
                    title={contact.isStarred ? "Remove from starred" : "Mark as starred"}
                  >
                    <Star className={`w-3.5 h-3.5 ${contact.isStarred ? "fill-amber-400" : ""}`} />
                  </button>
                  {onSelectSend && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSend(contact.address);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white text-slate-200 hover:text-black font-medium transition text-xs cursor-pointer"
                      title="Send funds to contact"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditForm(contact)}
                    className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition"
                    title="Edit contact"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteContact(contact.id, contact.name)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                    title="Delete contact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Backup / Restore */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExport}
              disabled={contacts.length === 0}
              className="flex items-center gap-1.5 hover:text-white transition disabled:opacity-30 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Backup</span>
            </button>
            <label className="flex items-center gap-1.5 hover:text-white transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Backup</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
          </div>
        </div>
      </div>
    </div>
  );
}
