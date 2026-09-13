/**
 * Private Address Book & Local Contacts for PRIVATUM Desktop.
 *
 * Stores friendly labels, notes, and categories for frequent counterparties.
 * 100% client-side and encrypted locally: zero cloud sync, zero counterparty graph leaks.
 */

export type ContactCategory =
  | "Personal"
  | "Work"
  | "Exchange"
  | "Cold Storage"
  | "Other";

export interface Contact {
  id: string;
  name: string;
  address: string; // 0x EVM address or st:eth:... stealth meta-address
  note?: string;
  category?: ContactCategory;
  createdAt: number;
  lastUsedAt?: number;
  isStarred?: boolean;
}

function getStorageKey(walletAddress: string): string {
  const normalized = (walletAddress || "").trim().toLowerCase();
  return `privatum_contacts_${normalized}`;
}

export function loadContacts(walletAddress: string): Contact[] {
  if (typeof window === "undefined" || !walletAddress) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveContacts(walletAddress: string, contacts: Contact[]): void {
  if (typeof window === "undefined" || !walletAddress) return;
  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(contacts));
  } catch (err) {
    console.error("Failed to save contacts:", err);
  }
}

export function addContact(
  walletAddress: string,
  contact: Omit<Contact, "id" | "createdAt">
): Contact {
  const existing = loadContacts(walletAddress);
  const newContact: Contact = {
    id: `contact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: contact.name.trim(),
    address: contact.address.trim(),
    note: contact.note?.trim() || undefined,
    category: contact.category || "Other",
    isStarred: Boolean(contact.isStarred),
    createdAt: Date.now(),
  };

  const updated = [newContact, ...existing];
  saveContacts(walletAddress, updated);
  return newContact;
}

export function updateContact(
  walletAddress: string,
  id: string,
  updates: Partial<Omit<Contact, "id" | "createdAt">>
): Contact[] {
  const existing = loadContacts(walletAddress);
  const updated = existing.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      name: updates.name !== undefined ? updates.name.trim() : c.name,
      address: updates.address !== undefined ? updates.address.trim() : c.address,
      note: updates.note !== undefined ? updates.note.trim() || undefined : c.note,
      category: updates.category !== undefined ? updates.category : c.category,
      isStarred: updates.isStarred !== undefined ? updates.isStarred : c.isStarred,
    };
  });

  saveContacts(walletAddress, updated);
  return updated;
}

export function toggleStarContact(walletAddress: string, id: string): Contact[] {
  const existing = loadContacts(walletAddress);
  const updated = existing.map((c) => {
    if (c.id !== id) return c;
    return { ...c, isStarred: !c.isStarred };
  });
  saveContacts(walletAddress, updated);
  return updated;
}

export function getStarredContacts(contacts: Contact[]): Contact[] {
  return contacts.filter((c) => Boolean(c.isStarred));
}

export function deleteContact(walletAddress: string, id: string): Contact[] {
  const existing = loadContacts(walletAddress);
  const updated = existing.filter((c) => c.id !== id);
  saveContacts(walletAddress, updated);
  return updated;
}

export function findContactByAddress(
  contacts: Contact[],
  address: string
): Contact | undefined {
  if (!address) return undefined;
  const clean = address.trim().toLowerCase();
  return contacts.find((c) => c.address.trim().toLowerCase() === clean);
}

export function searchContacts(
  contacts: Contact[],
  query: string,
  categoryFilter?: string
): Contact[] {
  const cleanQuery = query.trim().toLowerCase();
  return contacts.filter((c) => {
    let matchesCategory = true;
    if (categoryFilter === "Starred") {
      matchesCategory = Boolean(c.isStarred);
    } else if (categoryFilter && categoryFilter !== "All") {
      matchesCategory = c.category === categoryFilter;
    }

    if (!matchesCategory) return false;
    if (!cleanQuery) return true;

    return (
      c.name.toLowerCase().includes(cleanQuery) ||
      c.address.toLowerCase().includes(cleanQuery) ||
      (c.note && c.note.toLowerCase().includes(cleanQuery))
    );
  });
}

export function recordContactUsage(walletAddress: string, address: string): void {
  if (!walletAddress || !address) return;
  const contacts = loadContacts(walletAddress);
  const clean = address.trim().toLowerCase();
  let changed = false;

  const updated = contacts.map((c) => {
    if (c.address.trim().toLowerCase() === clean) {
      changed = true;
      return { ...c, lastUsedAt: Date.now() };
    }
    return c;
  });

  if (changed) {
    saveContacts(walletAddress, updated);
  }
}

/**
 * Returns the most recently used contacts, newest first.
 * Contacts that have never been sent to are excluded so the strip only ever
 * surfaces counterparties the user has actually transacted with.
 */
export function getRecentContacts(contacts: Contact[], limit = 3): Contact[] {
  return contacts
    .filter((c) => typeof c.lastUsedAt === "number" && c.lastUsedAt > 0)
    .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
    .slice(0, limit);
}
