import { saveEncryptedItem, loadEncryptedItem } from "./secureStorage";

/**
 * Mobile Private Address Book for PRIVATUM.
 * Stores friendly labels, notes, and categories with 100% device-side encryption.
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
  address: string;
  note?: string;
  category?: ContactCategory;
  createdAt: number;
  lastUsedAt?: number;
}

function getStorageKey(walletAddress: string): string {
  const normalized = (walletAddress || "").trim().toLowerCase();
  return `privatum_contacts_${normalized}`;
}

export async function loadMobileContacts(walletAddress: string): Promise<Contact[]> {
  if (!walletAddress) return [];
  try {
    const raw = await loadEncryptedItem(getStorageKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveMobileContacts(
  walletAddress: string,
  contacts: Contact[]
): Promise<void> {
  if (!walletAddress) return;
  try {
    await saveEncryptedItem(getStorageKey(walletAddress), JSON.stringify(contacts));
  } catch (err) {
    console.error("Failed to save mobile contacts:", err);
  }
}

export async function addMobileContact(
  walletAddress: string,
  contact: Omit<Contact, "id" | "createdAt">
): Promise<Contact> {
  const existing = await loadMobileContacts(walletAddress);
  const newContact: Contact = {
    id: `contact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: contact.name.trim(),
    address: contact.address.trim(),
    note: contact.note?.trim() || undefined,
    category: contact.category || "Other",
    createdAt: Date.now(),
  };

  const updated = [newContact, ...existing];
  await saveMobileContacts(walletAddress, updated);
  return newContact;
}

export async function updateMobileContact(
  walletAddress: string,
  id: string,
  updates: Partial<Omit<Contact, "id" | "createdAt">>
): Promise<Contact[]> {
  const existing = await loadMobileContacts(walletAddress);
  const updated = existing.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      name: updates.name !== undefined ? updates.name.trim() : c.name,
      address: updates.address !== undefined ? updates.address.trim() : c.address,
      note: updates.note !== undefined ? updates.note.trim() || undefined : c.note,
      category: updates.category !== undefined ? updates.category : c.category,
    };
  });

  await saveMobileContacts(walletAddress, updated);
  return updated;
}

export async function deleteMobileContact(
  walletAddress: string,
  id: string
): Promise<Contact[]> {
  const existing = await loadMobileContacts(walletAddress);
  const updated = existing.filter((c) => c.id !== id);
  await saveMobileContacts(walletAddress, updated);
  return updated;
}

export function findMobileContactByAddress(
  contacts: Contact[],
  address: string
): Contact | undefined {
  if (!address) return undefined;
  const clean = address.trim().toLowerCase();
  return contacts.find((c) => c.address.trim().toLowerCase() === clean);
}

export function searchMobileContacts(
  contacts: Contact[],
  query: string,
  categoryFilter?: string
): Contact[] {
  const cleanQuery = query.trim().toLowerCase();
  return contacts.filter((c) => {
    const matchesCategory =
      !categoryFilter ||
      categoryFilter === "All" ||
      c.category === categoryFilter;

    if (!matchesCategory) return false;
    if (!cleanQuery) return true;

    return (
      c.name.toLowerCase().includes(cleanQuery) ||
      c.address.toLowerCase().includes(cleanQuery) ||
      (c.note && c.note.toLowerCase().includes(cleanQuery))
    );
  });
}

/**
 * Stamps a contact as just used so it surfaces in the recent-contacts strip.
 * No-ops when the address is not in the address book.
 */
export async function recordMobileContactUsage(
  walletAddress: string,
  address: string
): Promise<Contact[]> {
  const contacts = await loadMobileContacts(walletAddress);
  if (!walletAddress || !address) return contacts;

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
    await saveMobileContacts(walletAddress, updated);
  }
  return updated;
}

/**
 * Returns the most recently used contacts, newest first.
 * Contacts never sent to are excluded.
 */
export function getRecentMobileContacts(contacts: Contact[], limit = 3): Contact[] {
  return contacts
    .filter((c) => typeof c.lastUsedAt === "number" && c.lastUsedAt > 0)
    .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
    .slice(0, limit);
}
