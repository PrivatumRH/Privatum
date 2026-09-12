import * as SecureStore from "expo-secure-store";

/**
 * Hardware-backed mobile credential storage using Android Keystore / iOS Keychain.
 * Stores Shard A private key and user settings with zero cloud backup exposure.
 */

const KEY_ACTIVE_ACCOUNT = "privatum_active_account";
const KEY_PREFIX_SHARD_A = "privatum_shard_a_";
const KEY_PREFIX_GUARDRAILS = "privatum_guardrails_";
const KEY_PREFIX_CONTACTS = "privatum_contacts_";

export async function saveActiveAccount(address: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_ACTIVE_ACCOUNT, address.trim().toLowerCase());
  } catch (err) {
    console.error("Failed to save active account:", err);
  }
}

export async function loadActiveAccount(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_ACTIVE_ACCOUNT);
  } catch {
    return null;
  }
}

export async function saveDeviceShard(walletAddress: string, privateKey: string): Promise<void> {
  try {
    const key = `${KEY_PREFIX_SHARD_A}${walletAddress.trim().toLowerCase()}`;
    await SecureStore.setItemAsync(key, privateKey.trim());
  } catch (err) {
    console.error("Failed to save device shard:", err);
  }
}

export async function loadDeviceShard(walletAddress: string): Promise<string | null> {
  try {
    const key = `${KEY_PREFIX_SHARD_A}${walletAddress.trim().toLowerCase()}`;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function deleteDeviceShard(walletAddress: string): Promise<void> {
  try {
    const key = `${KEY_PREFIX_SHARD_A}${walletAddress.trim().toLowerCase()}`;
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.error("Failed to delete device shard:", err);
  }
}

export async function saveEncryptedItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.error(`Failed to save ${key}:`, err);
  }
}

export async function loadEncryptedItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function deleteEncryptedItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.error(`Failed to delete ${key}:`, err);
  }
}

export async function clearActiveAccount(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_ACTIVE_ACCOUNT);
  } catch (err) {
    console.error("Failed to clear active account:", err);
  }
}

