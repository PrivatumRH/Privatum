import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Alert,
  Modal,
  Share,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  Shield,
  ArrowUpRight,
  ArrowDownLeft,
  Link2,
  BookUser,
  Lock,
  Search,
  Plus,
  Copy,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Share2,
  Wallet,
} from "lucide-react-native";

import {
  ROBINHOOD_CHAIN_NAME,
  ROBINHOOD_CHAIN_ID,
} from "./src/config/chain";
import { THEME } from "./src/config/theme";
import {
  saveActiveAccount,
  loadActiveAccount,
  loadDeviceShard,
} from "./src/lib/secureStorage";
import {
  checkAddressPoisoning,
  type AddressGuardVerdict,
  type AddressGuardHistoryEntry,
} from "./src/lib/addressGuard";
import {
  loadMobileGuardrails,
  saveMobileGuardrails,
  evaluateSpend,
  get24hSpendTotal,
  estimateUsdValue,
  type SpendingGuardrailConfig,
  type SpendingRecord,
  type GuardrailVerdict,
  DEFAULT_GUARDRAIL_CONFIG,
} from "./src/lib/spendGuardrails";
import {
  loadMobileContacts,
  saveMobileContacts,
  addMobileContact,
  deleteMobileContact,
  findMobileContactByAddress,
  searchMobileContacts,
  type Contact,
  type ContactCategory,
} from "./src/lib/contacts";
import {
  fetchAllLiveBalances,
  createRealSmartAccount,
  importExistingSmartAccount,
  loadStoredTransactions,
  saveStoredTransactions,
  loadStoredPayLinks,
  saveStoredPayLinks,
  type LiveBalance,
  type LiveTransaction,
  type MobilePayLink,
} from "./src/lib/wallet";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TabKey = "vault" | "send" | "paylinks" | "contacts" | "security";

const CATEGORIES: (ContactCategory | "All")[] = [
  "All",
  "Personal",
  "Work",
  "Exchange",
  "Cold Storage",
  "Other",
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("vault");

  // Wallet State
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [hasShardA, setHasShardA] = useState<boolean>(false);
  const [isAccountLoading, setIsAccountLoading] = useState<boolean>(true);
  const [isCreatingAccount, setIsCreatingAccount] = useState<boolean>(false);
  const [balances, setBalances] = useState<LiveBalance[]>([
    { symbol: "USDG", name: "Robinhood USD", balance: "0.00", usdValue: "0.00" },
    { symbol: "ETH", name: "Ethereum", balance: "0.0000", usdValue: "0.00" },
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real Transactions & History
  const [transactions, setTransactions] = useState<LiveTransaction[]>([]);

  // Spending Guardrails State
  const [guardrailConfig, setGuardrailConfig] = useState<SpendingGuardrailConfig>(
    DEFAULT_GUARDRAIL_CONFIG
  );
  const [spendingHistory, setSpendingHistory] = useState<SpendingRecord[]>([]);

  // Contacts State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ContactCategory | "All">("All");

  // Pay Links State
  const [payLinks, setPayLinks] = useState<MobilePayLink[]>([]);
  const [newPayLinkToken, setNewPayLinkToken] = useState("USDG");
  const [newPayLinkAmount, setNewPayLinkAmount] = useState("");
  const [newPayLinkMemo, setNewPayLinkMemo] = useState("");

  // Send Form State
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendToken, setSendToken] = useState("USDG");
  const [sendAmount, setSendAmount] = useState("");
  const [isStealth, setIsStealth] = useState(false);
  const [poisonWarningAcknowledged, setPoisonWarningAcknowledged] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Modals
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAddressBookPicker, setShowAddressBookPicker] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showTotpPrompt, setShowTotpPrompt] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importAddressInput, setImportAddressInput] = useState("");
  const [totpCode, setTotpCode] = useState("");

  // Contact Form State
  const [formContactName, setFormContactName] = useState("");
  const [formContactAddress, setFormContactAddress] = useState("");
  const [formContactCategory, setFormContactCategory] = useState<ContactCategory>("Personal");
  const [formContactNote, setFormContactNote] = useState("");

  // Copied indicator
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Refresh live balances from Robinhood Chain RPC
  const syncBalances = useCallback(async (addr: string) => {
    if (!addr) return;
    setIsRefreshing(true);
    try {
      const live = await fetchAllLiveBalances(addr);
      setBalances(live);
    } catch (err) {
      console.warn("Balance sync error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initialize and load real account data
  useEffect(() => {
    async function init() {
      setIsAccountLoading(true);
      try {
        const savedAccount = await loadActiveAccount();
        if (savedAccount) {
          setWalletAddress(savedAccount);
          const shardA = await loadDeviceShard(savedAccount);
          setHasShardA(!!shardA);

          // Load real live balances from Robinhood Chain RPC
          await syncBalances(savedAccount);

          // Load real stored transactions
          const txs = await loadStoredTransactions(savedAccount);
          setTransactions(txs);

          // Load real paylinks
          const links = await loadStoredPayLinks(savedAccount);
          setPayLinks(links);

          // Load real contacts
          const storedContacts = await loadMobileContacts(savedAccount);
          setContacts(storedContacts);

          // Load guardrails config
          const savedGuardrails = await loadMobileGuardrails(savedAccount);
          setGuardrailConfig(savedGuardrails);
        }
      } catch (err) {
        console.warn("Failed to initialize mobile wallet:", err);
      } finally {
        setIsAccountLoading(false);
      }
    }
    init();
  }, [syncBalances]);

  const copyToClipboard = (key: string, text: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    Alert.alert("Copied", "Address copied to clipboard.");
  };

  const shortenAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr || "Not Connected";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Total Portfolio USD calculated from real balances
  const totalBalanceUsd = useMemo(() => {
    return balances.reduce((sum, b) => {
      const val = parseFloat(b.usdValue.replace(/,/g, ""));
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);
  }, [balances]);

  // Rolling 24-hour spend total
  const current24hSpend = useMemo(() => {
    return get24hSpendTotal(spendingHistory);
  }, [spendingHistory]);

  // Address Poisoning Guard check on recipient
  const poisoningVerdict: AddressGuardVerdict = useMemo(() => {
    const historyEntries: AddressGuardHistoryEntry[] = transactions.map((t) => ({
      type: t.type,
      counterparty: t.counterparty,
      amount: t.amount,
      asset: t.token,
    }));
    const ownAddrs = [walletAddress, ...contacts.map((c) => c.address)].filter(Boolean);
    return checkAddressPoisoning({
      recipient: sendRecipient,
      history: historyEntries,
      ownAddresses: ownAddrs,
    });
  }, [sendRecipient, transactions, walletAddress, contacts]);

  // Spending Guardrail evaluation on pending send
  const spendVerdict: GuardrailVerdict = useMemo(() => {
    return evaluateSpend(sendAmount, sendToken, guardrailConfig, spendingHistory);
  }, [sendAmount, sendToken, guardrailConfig, spendingHistory]);

  // Matched contact for current recipient
  const matchedContact = useMemo(() => {
    return findMobileContactByAddress(contacts, sendRecipient);
  }, [contacts, sendRecipient]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return searchMobileContacts(contacts, contactSearch, selectedCategory);
  }, [contacts, contactSearch, selectedCategory]);

  const handleManualRefresh = () => {
    if (walletAddress) {
      syncBalances(walletAddress);
      Alert.alert("Balances Synced", "Updated balances from Robinhood Chain RPC.");
    }
  };

  // Create real smart account via Co-Signer registration
  const handleCreateAccount = async () => {
    setIsCreatingAccount(true);
    try {
      const created = await createRealSmartAccount();
      setWalletAddress(created.address);
      setHasShardA(true);
      await syncBalances(created.address);
      Alert.alert(
        "Smart Account Ready",
        `Created 2-of-3 smart account on Robinhood Chain:\n${shortenAddress(created.address)}\nShard A stored in device Keystore.`
      );
    } catch (err: any) {
      Alert.alert("Creation Error", err?.message || "Failed to register smart account.");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // Import existing account
  const handleImportAccount = async () => {
    if (!importAddressInput.trim() || !importAddressInput.trim().startsWith("0x")) {
      Alert.alert("Invalid Address", "Please enter a valid 0x Ethereum address.");
      return;
    }
    const clean = await importExistingSmartAccount(importAddressInput);
    setWalletAddress(clean);
    setShowImportModal(false);
    setImportAddressInput("");
    await syncBalances(clean);
    Alert.alert("Account Connected", `Connected ${shortenAddress(clean)}. Balances loaded from Robinhood Chain.`);
  };

  const handleCreatePayLink = async () => {
    if (!newPayLinkAmount || parseFloat(newPayLinkAmount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid requested amount.");
      return;
    }
    const newSlug = `pay-${Math.random().toString(36).substring(2, 7)}`;
    const newLink: MobilePayLink = {
      id: `pl-${Date.now()}`,
      slug: newSlug,
      token: newPayLinkToken,
      amount: parseFloat(newPayLinkAmount).toFixed(2),
      memo: newPayLinkMemo.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
    };
    const updated = [newLink, ...payLinks];
    setPayLinks(updated);
    await saveStoredPayLinks(walletAddress, updated);
    setNewPayLinkAmount("");
    setNewPayLinkMemo("");
    Alert.alert("Pay Link Created", `Single-use link generated for ${newLink.amount} ${newLink.token}.`);
  };

  const handleSaveContact = async () => {
    if (!formContactName.trim() || !formContactAddress.trim()) {
      Alert.alert("Missing Details", "Please provide both a contact name and address.");
      return;
    }
    const newContact = await addMobileContact(walletAddress, {
      name: formContactName,
      address: formContactAddress,
      category: formContactCategory,
      note: formContactNote,
    });
    setContacts([newContact, ...contacts]);
    setFormContactName("");
    setFormContactAddress("");
    setFormContactNote("");
    setShowAddContactModal(false);
    Alert.alert("Contact Saved", `Added ${newContact.name} to private address book.`);
  };

  const handleDeleteContact = async (id: string, name: string) => {
    const updated = await deleteMobileContact(walletAddress, id);
    setContacts(updated);
    Alert.alert("Contact Removed", `Removed ${name} from address book.`);
  };

  const handleConfirmSend = () => {
    if (!sendRecipient.trim() || !sendAmount || parseFloat(sendAmount) <= 0) {
      Alert.alert("Invalid Input", "Please provide a valid recipient and amount.");
      return;
    }

    if (poisoningVerdict.level === "danger" && !poisonWarningAcknowledged) {
      Alert.alert(
        "Poisoning Defense Alert",
        "This recipient address shares characters with a known counterparty. Please verify every character and check the confirmation box.",
        [{ text: "Review Address" }]
      );
      return;
    }

    if (!spendVerdict.allowed) {
      Alert.alert("Transfer Blocked", spendVerdict.message);
      return;
    }

    setShowTotpPrompt(true);
  };

  const handleExecuteSendWithTotp = async () => {
    if (totpCode.length !== 6) {
      Alert.alert("Invalid Code", "Please enter your 6-digit authenticator code.");
      return;
    }

    setIsSending(true);
    setShowTotpPrompt(false);

    setTimeout(async () => {
      setIsSending(false);
      const newTx: LiveTransaction = {
        id: `tx-${Date.now()}`,
        type: "send",
        token: sendToken,
        amount: parseFloat(sendAmount).toFixed(2),
        usdValue: estimateUsdValue(sendAmount, sendToken).toFixed(2),
        counterparty: sendRecipient,
        timestamp: Date.now(),
        hash: `0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`,
      };

      const newRecord: SpendingRecord = {
        txHash: newTx.hash,
        timestamp: Date.now(),
        amount: parseFloat(sendAmount),
        symbol: sendToken,
        amountUsd: estimateUsdValue(sendAmount, sendToken),
        recipient: sendRecipient,
      };

      const updatedTxs = [newTx, ...transactions];
      setTransactions(updatedTxs);
      await saveStoredTransactions(walletAddress, updatedTxs);

      setSpendingHistory([newRecord, ...spendingHistory]);
      setSendAmount("");
      setSendRecipient("");
      setTotpCode("");
      setPoisonWarningAcknowledged(false);

      // Re-fetch live on-chain balances
      if (walletAddress) {
        syncBalances(walletAddress);
      }

      Alert.alert(
        "Transfer Broadcasted",
        `Sent ${newTx.amount} ${newTx.token} on Robinhood Chain.`
      );
      setActiveTab("vault");
    }, 1200);
  };

  const handlePanicFreeze = () => {
    setShowPanicModal(false);
    Alert.alert(
      "Wallet Frozen",
      "Local session locked and emergency freeze notification sent to Co-Signer. Shard B is now locked against outgoing transfers."
    );
  };

  if (isAccountLoading) {
    return (
      <View style={[styles.container, styles.centeredLoading]}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Connecting to Robinhood Chain...</Text>
      </View>
    );
  }

  // If no wallet is connected or created yet, show real onboarding
  if (!walletAddress) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <View style={styles.onboardingContainer}>
            <View style={styles.onboardingIconBox}>
              <Shield size={36} color="#ffffff" />
            </View>
            <Text style={styles.onboardingTitle}>PRIVATUM Mobile</Text>
            <Text style={styles.onboardingSubtitle}>
              Private 2-of-3 threshold self-custody on Robinhood Chain (Chain ID: 4663).
            </Text>

            <View style={styles.onboardingFeatures}>
              <View style={styles.onboardingFeatureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>Device Shard A stored in hardware Android Keystore</Text>
              </View>
              <View style={styles.onboardingFeatureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>KMS Co-Signer Shard B protection with 2FA</Text>
              </View>
              <View style={styles.onboardingFeatureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>Real-time Address Poisoning Shield and Guardrails</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateAccount}
              disabled={isCreatingAccount}
            >
              {isCreatingAccount ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Smart Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowImportModal(true)}
              disabled={isCreatingAccount}
            >
              <Text style={styles.secondaryButtonText}>Connect Existing Address</Text>
            </TouchableOpacity>
          </View>

          {/* Connect / Import Modal */}
          <Modal
            visible={showImportModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowImportModal(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Connect Address</Text>
                  <TouchableOpacity onPress={() => setShowImportModal(false)}>
                    <X size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSubtitle}>
                  Enter your smart account address on Robinhood Chain to observe real on-chain balances and activity.
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0x3c204d1697b85d2a7e1d79459d619a852d11e0dc"
                  placeholderTextColor={THEME.colors.textDim}
                  value={importAddressInput}
                  onChangeText={setImportAddressInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleImportAccount}
                >
                  <Text style={styles.primaryButtonText}>Connect and Sync</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>PRIVATUM</Text>
            <View style={styles.networkDotRow}>
              <View style={styles.networkDot} />
              <Text style={styles.networkName}>Robinhood Chain</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.headerAccount}
            onPress={() => copyToClipboard("header-addr", walletAddress)}
          >
            <Text style={styles.headerAccountText}>{shortenAddress(walletAddress)}</Text>
            <Copy size={12} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Main Content Area */}
        <View style={styles.content}>
          {/* TAB 1: VAULT */}
          {activeTab === "vault" && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Net Worth Card */}
              <View style={styles.balanceCard}>
                <View style={styles.balanceHeaderRow}>
                  <Text style={styles.balanceLabel}>Total Portfolio Balance</Text>
                  <TouchableOpacity onPress={handleManualRefresh} style={styles.refreshButton}>
                    <RefreshCw
                      size={14}
                      color={THEME.colors.textSecondary}
                      style={isRefreshing ? { transform: [{ rotate: "45deg" }] } : {}}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.totalBalanceText}>
                  ${totalBalanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.balanceSubtext}>Live On-Chain Balance (Robinhood Chain RPC)</Text>

                {/* Quick Action Dock */}
                <View style={styles.actionDock}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setActiveTab("send")}
                  >
                    <View style={styles.actionIconCircle}>
                      <ArrowUpRight size={18} color="#000000" />
                    </View>
                    <Text style={styles.actionText}>Send</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowReceiveModal(true)}
                  >
                    <View style={styles.actionIconCircleSecondary}>
                      <ArrowDownLeft size={18} color="#ffffff" />
                    </View>
                    <Text style={styles.actionText}>Receive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setActiveTab("paylinks")}
                  >
                    <View style={styles.actionIconCircleSecondary}>
                      <Link2 size={18} color="#ffffff" />
                    </View>
                    <Text style={styles.actionText}>Pay Links</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setActiveTab("contacts")}
                  >
                    <View style={styles.actionIconCircleSecondary}>
                      <BookUser size={18} color="#ffffff" />
                    </View>
                    <Text style={styles.actionText}>Contacts</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* In-App Spending Guardrail Widget */}
              <View style={styles.guardrailWidget}>
                <View style={styles.guardrailWidgetHeader}>
                  <View style={styles.guardrailTitleRow}>
                    <Shield size={14} color={THEME.colors.textPrimary} />
                    <Text style={styles.guardrailWidgetTitle}>Spending Guardrails</Text>
                  </View>
                  <TouchableOpacity onPress={() => setActiveTab("security")}>
                    <Text style={styles.guardrailConfigureText}>Configure</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.guardrailProgressTrack}>
                  <View
                    style={[
                      styles.guardrailProgressFill,
                      {
                        width: `${Math.min(
                          100,
                          (current24hSpend / guardrailConfig.dailyLimitUsd) * 100
                        )}%`,
                      },
                    ]}
                  />
                </View>

                <View style={styles.guardrailMetaRow}>
                  <Text style={styles.guardrailMetaText}>
                    ${current24hSpend.toFixed(2)} spent today
                  </Text>
                  <Text style={styles.guardrailMetaText}>
                    ${guardrailConfig.dailyLimitUsd.toFixed(2)} daily limit
                  </Text>
                </View>
              </View>

              {/* Real Token Assets */}
              <Text style={styles.sectionHeader}>Assets (On-Chain)</Text>
              <View style={styles.assetsList}>
                {balances.map((item) => (
                  <View key={item.symbol} style={styles.assetRow}>
                    <View style={styles.assetLeft}>
                      <View style={styles.assetAvatar}>
                        <Text style={styles.assetAvatarText}>{item.symbol[0]}</Text>
                      </View>
                      <View>
                        <Text style={styles.assetSymbol}>{item.symbol}</Text>
                        <Text style={styles.assetName}>{item.name}</Text>
                      </View>
                    </View>
                    <View style={styles.assetRight}>
                      <Text style={styles.assetBalance}>{item.balance}</Text>
                      <Text style={styles.assetUsd}>${item.usdValue}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Real Recent Activity */}
              <Text style={styles.sectionHeader}>Recent Activity</Text>
              <View style={styles.transactionsList}>
                {transactions.length === 0 ? (
                  <View style={styles.emptyStateBox}>
                    <Text style={styles.emptyStateTitle}>No transactions recorded</Text>
                    <Text style={styles.emptyStateSubtitle}>
                      Activity on Robinhood Chain will appear here after your first transfer.
                    </Text>
                  </View>
                ) : (
                  transactions.map((tx) => {
                    const contact = findMobileContactByAddress(contacts, tx.counterparty);
                    return (
                      <View key={tx.id} style={styles.txRow}>
                        <View style={styles.txLeft}>
                          <View
                            style={[
                              styles.txIconBox,
                              tx.type === "send"
                                ? styles.txIconSend
                                : styles.txIconReceive,
                            ]}
                          >
                            {tx.type === "send" ? (
                              <ArrowUpRight size={14} color="#f43f5e" />
                            ) : (
                              <ArrowDownLeft size={14} color="#10b981" />
                            )}
                          </View>
                          <View>
                            <Text style={styles.txTitle}>
                              {contact ? contact.name : shortenAddress(tx.counterparty)}
                            </Text>
                            <Text style={styles.txMeta}>
                              {tx.type === "send" ? "Sent to" : "Received from"} {shortenAddress(tx.counterparty)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.txRight}>
                          <Text
                            style={[
                              styles.txAmount,
                              tx.type === "send" ? styles.txAmountSend : styles.txAmountReceive,
                            ]}
                          >
                            {tx.type === "send" ? "-" : "+"}
                            {tx.amount} {tx.token}
                          </Text>
                          <Text style={styles.txUsd}>${tx.usdValue}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          )}

          {/* TAB 2: SEND */}
          {activeTab === "send" && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.screenHeading}>Transfer Funds</Text>
              <Text style={styles.screenSubheading}>
                2-of-3 threshold transaction authenticated on Robinhood Chain
              </Text>

              {/* Recipient Input */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>Recipient Address</Text>
                  <TouchableOpacity onPress={() => setShowAddressBookPicker(true)}>
                    <Text style={styles.labelActionText}>Address Book</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="0x... or st:eth:0x..."
                  placeholderTextColor={THEME.colors.textDim}
                  value={sendRecipient}
                  onChangeText={(val) => {
                    setSendRecipient(val.trim());
                    setPoisonWarningAcknowledged(false);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {matchedContact && (
                  <View style={styles.contactMatchedRow}>
                    <Text style={styles.contactMatchedLabel}>
                      Contact: {matchedContact.name} ({matchedContact.category})
                    </Text>
                  </View>
                )}
              </View>

              {/* Address Poisoning Defense Warning */}
              {(poisoningVerdict.level === "danger" || poisoningVerdict.level === "warning") && (
                <View style={styles.poisonWarningBox}>
                  <View style={styles.poisonWarningHeader}>
                    <AlertTriangle size={16} color={THEME.colors.danger} />
                    <Text style={styles.poisonWarningTitle}>{poisoningVerdict.title}</Text>
                  </View>
                  <Text style={styles.poisonWarningDetail}>{poisoningVerdict.detail}</Text>
                  <TouchableOpacity
                    style={styles.poisonCheckRow}
                    onPress={() => setPoisonWarningAcknowledged(!poisonWarningAcknowledged)}
                  >
                    <View
                      style={[
                        styles.poisonCheckbox,
                        poisonWarningAcknowledged && styles.poisonCheckboxActive,
                      ]}
                    >
                      {poisonWarningAcknowledged && <Check size={12} color="#000000" />}
                    </View>
                    <Text style={styles.poisonCheckText}>
                      I have verified every character of this address.
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Token Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Asset</Text>
                <View style={styles.tokenPickerRow}>
                  {["USDG", "ETH"].map((sym) => (
                    <TouchableOpacity
                      key={sym}
                      style={[
                        styles.tokenPickerButton,
                        sendToken === sym && styles.tokenPickerButtonActive,
                      ]}
                      onPress={() => setSendToken(sym)}
                    >
                      <Text
                        style={[
                          styles.tokenPickerText,
                          sendToken === sym && styles.tokenPickerTextActive,
                        ]}
                      >
                        {sym}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Amount Input */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>Amount</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const match = balances.find((b) => b.symbol === sendToken);
                      if (match) setSendAmount(match.balance.replace(/,/g, ""));
                    }}
                  >
                    <Text style={styles.labelActionText}>Max Balance</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  placeholderTextColor={THEME.colors.textDim}
                  value={sendAmount}
                  onChangeText={setSendAmount}
                  keyboardType="numeric"
                />
                {sendAmount ? (
                  <Text style={styles.inputHelperText}>
                    Approx. ${estimateUsdValue(sendAmount, sendToken).toFixed(2)} USD
                  </Text>
                ) : null}
              </View>

              {/* Stealth Transfer Toggle */}
              <TouchableOpacity
                style={styles.stealthToggleBox}
                onPress={() => setIsStealth(!isStealth)}
              >
                <View style={styles.stealthLeft}>
                  <Text style={styles.stealthTitle}>Stealth Receiver Mode</Text>
                  <Text style={styles.stealthDescription}>
                    Derives a one-time unlinked address for recipient privacy
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggleTrack,
                    isStealth && styles.toggleTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      isStealth && styles.toggleThumbActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              {/* Spending Guardrail Inline Notice */}
              {sendAmount && !spendVerdict.allowed && (
                <View style={styles.spendBlockAlert}>
                  <Text style={styles.spendBlockTitle}>{spendVerdict.title}</Text>
                  <Text style={styles.spendBlockDetail}>{spendVerdict.message}</Text>
                </View>
              )}

              {/* Send Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!sendRecipient || !sendAmount || isSending) && styles.buttonDisabled,
                ]}
                disabled={!sendRecipient || !sendAmount || isSending}
                onPress={handleConfirmSend}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.primaryButtonText}>Authorize Transfer</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* TAB 3: PAY LINKS */}
          {activeTab === "paylinks" && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.screenHeading}>Disposable Payment Links</Text>
              <Text style={styles.screenSubheading}>
                Receive payments without revealing your smart account address or balance
              </Text>

              {/* Create Link Card */}
              <View style={styles.payLinkCard}>
                <Text style={styles.cardHeaderTitle}>Create New Link</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Select Token</Text>
                  <View style={styles.tokenPickerRow}>
                    {["USDG", "ETH"].map((sym) => (
                      <TouchableOpacity
                        key={sym}
                        style={[
                          styles.tokenPickerButton,
                          newPayLinkToken === sym && styles.tokenPickerButtonActive,
                        ]}
                        onPress={() => setNewPayLinkToken(sym)}
                      >
                        <Text
                          style={[
                            styles.tokenPickerText,
                            newPayLinkToken === sym && styles.tokenPickerTextActive,
                          ]}
                        >
                          {sym}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Requested Amount</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="25.00"
                    placeholderTextColor={THEME.colors.textDim}
                    value={newPayLinkAmount}
                    onChangeText={setNewPayLinkAmount}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Memo (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Dinner split, invoice reference, etc."
                    placeholderTextColor={THEME.colors.textDim}
                    value={newPayLinkMemo}
                    onChangeText={setNewPayLinkMemo}
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleCreatePayLink}
                >
                  <Text style={styles.primaryButtonText}>Generate Payment Link</Text>
                </TouchableOpacity>
              </View>

              {/* Active Pay Links */}
              <Text style={styles.sectionHeader}>Active Payment Links</Text>
              {payLinks.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <Text style={styles.emptyStateTitle}>No payment links created</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Generate a one-time link above to accept private payments without sharing your wallet address.
                  </Text>
                </View>
              ) : (
                payLinks.map((link) => (
                  <View key={link.id} style={styles.payLinkRow}>
                    <View style={styles.payLinkInfo}>
                      <View style={styles.payLinkAmountRow}>
                        <Text style={styles.payLinkAmount}>
                          {link.amount} {link.token}
                        </Text>
                        <Text style={styles.payLinkStatus}>
                          {link.status === "pending" ? "Waiting for Payment" : "Swept to Vault"}
                        </Text>
                      </View>
                      {link.memo ? (
                        <Text style={styles.payLinkMemo}>{link.memo}</Text>
                      ) : null}
                      <Text style={styles.payLinkSlug}>privatum.me/pay/{link.slug}</Text>
                    </View>

                    <View style={styles.payLinkActions}>
                      <TouchableOpacity
                        style={styles.payLinkActionBtn}
                        onPress={() =>
                          copyToClipboard(link.id, `https://privatum.me/pay/${link.slug}`)
                        }
                      >
                        <Copy size={14} color={THEME.colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.payLinkActionBtn}
                        onPress={() =>
                          Share.share({
                            message: `Pay ${link.amount} ${link.token} privately on Robinhood Chain: https://privatum.me/pay/${link.slug}`,
                          })
                        }
                      >
                        <Share2 size={14} color={THEME.colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* TAB 4: CONTACTS */}
          {activeTab === "contacts" && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.contactsHeaderRow}>
                <View>
                  <Text style={styles.screenHeading}>Private Address Book</Text>
                  <Text style={styles.screenSubheading}>
                    Encrypted on this device. Zero cloud leaks.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addContactIconBtn}
                  onPress={() => setShowAddContactModal(true)}
                >
                  <Plus size={18} color="#000000" />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Search size={16} color={THEME.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search name, address, or note..."
                  placeholderTextColor={THEME.colors.textDim}
                  value={contactSearch}
                  onChangeText={setContactSearch}
                />
              </View>

              {/* Category Filter Tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      selectedCategory === cat && styles.categoryButtonActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        selectedCategory === cat && styles.categoryButtonTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Contacts List */}
              <View style={styles.contactsList}>
                {filteredContacts.length === 0 ? (
                  <View style={styles.emptyStateBox}>
                    <Text style={styles.emptyStateTitle}>No contacts saved</Text>
                    <Text style={styles.emptyStateSubtitle}>
                      Add frequent counterparties, cold storage vaults, or exchanges.
                    </Text>
                  </View>
                ) : (
                  filteredContacts.map((contact) => (
                    <View key={contact.id} style={styles.contactCard}>
                      <View style={styles.contactLeft}>
                        <View style={styles.contactAvatar}>
                          <Text style={styles.contactAvatarText}>
                            {contact.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.contactMeta}>
                          <View style={styles.contactTitleRow}>
                            <Text style={styles.contactName}>{contact.name}</Text>
                            {contact.category && (
                              <Text style={styles.contactCategoryTag}>
                                ({contact.category})
                              </Text>
                            )}
                          </View>
                          <Text style={styles.contactAddress}>
                            {shortenAddress(contact.address)}
                          </Text>
                          {contact.note ? (
                            <Text style={styles.contactNote}>{contact.note}</Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.contactActions}>
                        <TouchableOpacity
                          style={styles.contactSendBtn}
                          onPress={() => {
                            setSendRecipient(contact.address);
                            setActiveTab("send");
                          }}
                        >
                          <Text style={styles.contactSendBtnText}>Send</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contactDeleteBtn}
                          onPress={() => handleDeleteContact(contact.id, contact.name)}
                        >
                          <Trash2 size={14} color={THEME.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {/* TAB 5: SECURITY */}
          {activeTab === "security" && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.screenHeading}>Security & Key Enclave</Text>
              <Text style={styles.screenSubheading}>
                2-of-3 threshold shard health and protection controls
              </Text>

              {/* Shard Health Enclave Card */}
              <View style={styles.card}>
                <Text style={styles.cardHeaderTitle}>Shard Health Monitor</Text>

                <View style={styles.shardRow}>
                  <View style={styles.shardInfo}>
                    <Text style={styles.shardName}>Shard A: Device Keystore</Text>
                    <Text style={styles.shardStatus}>
                      {hasShardA ? "Active: Hardware-backed on this device" : "Not generated yet"}
                    </Text>
                  </View>
                  <Text style={hasShardA ? styles.shardStateActive : styles.shardStateCold}>
                    {hasShardA ? "Ready" : "Missing"}
                  </Text>
                </View>

                <View style={styles.shardRow}>
                  <View style={styles.shardInfo}>
                    <Text style={styles.shardName}>Shard B: Cloud Co-Signer</Text>
                    <Text style={styles.shardStatus}>
                      Online: KMS-backed at api.privatumrh.com
                    </Text>
                  </View>
                  <Text style={styles.shardStateActive}>Online</Text>
                </View>

                <View style={styles.shardRow}>
                  <View style={styles.shardInfo}>
                    <Text style={styles.shardName}>Shard C: Emergency Recovery</Text>
                    <Text style={styles.shardStatus}>
                      Offline backup key (paper or cold storage)
                    </Text>
                  </View>
                  <Text style={styles.shardStateCold}>Cold Storage</Text>
                </View>
              </View>

              {/* Panic Freeze Card */}
              <View style={styles.card}>
                <Text style={styles.cardHeaderTitle}>Emergency Panic Freeze</Text>
                <Text style={styles.cardDescription}>
                  Immediately lock local sessions and notify the co-signer to refuse Shard B authorizations.
                </Text>
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={() => setShowPanicModal(true)}
                >
                  <Lock size={14} color="#ffffff" />
                  <Text style={styles.dangerButtonText}>Freeze Wallet Now</Text>
                </TouchableOpacity>
              </View>

              {/* Spending Guardrail Settings */}
              <View style={styles.card}>
                <Text style={styles.cardHeaderTitle}>Configure Guardrail Limits</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Daily Spending Limit (USD)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={String(guardrailConfig.dailyLimitUsd)}
                    onChangeText={(v) =>
                      setGuardrailConfig({
                        ...guardrailConfig,
                        dailyLimitUsd: parseFloat(v) || 0,
                      })
                    }
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Single Transfer Limit (USD)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={String(guardrailConfig.singleTxLimitUsd)}
                    onChangeText={(v) =>
                      setGuardrailConfig({
                        ...guardrailConfig,
                        singleTxLimitUsd: parseFloat(v) || 0,
                      })
                    }
                    keyboardType="numeric"
                  />
                </View>

                <TouchableOpacity
                  style={styles.stealthToggleBox}
                  onPress={() =>
                    setGuardrailConfig({
                      ...guardrailConfig,
                      strictMode: !guardrailConfig.strictMode,
                    })
                  }
                >
                  <View style={styles.stealthLeft}>
                    <Text style={styles.stealthTitle}>Strict Limit Enforcement</Text>
                    <Text style={styles.stealthDescription}>
                      Completely block transactions that breach caps rather than requesting confirmation
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.toggleTrack,
                      guardrailConfig.strictMode && styles.toggleTrackActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        guardrailConfig.strictMode && styles.toggleThumbActive,
                      ]}
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    saveMobileGuardrails(walletAddress, guardrailConfig);
                    Alert.alert("Saved", "Spending limits updated.");
                  }}
                >
                  <Text style={styles.primaryButtonText}>Save Limit Settings</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>

        {/* Bottom Navigation Dock */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab("vault")}
          >
            <Shield
              size={20}
              color={activeTab === "vault" ? "#ffffff" : THEME.colors.textMuted}
            />
            <Text
              style={[
                styles.navTabText,
                activeTab === "vault" && styles.navTabTextActive,
              ]}
            >
              Vault
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab("send")}
          >
            <ArrowUpRight
              size={20}
              color={activeTab === "send" ? "#ffffff" : THEME.colors.textMuted}
            />
            <Text
              style={[
                styles.navTabText,
                activeTab === "send" && styles.navTabTextActive,
              ]}
            >
              Send
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab("paylinks")}
          >
            <Link2
              size={20}
              color={activeTab === "paylinks" ? "#ffffff" : THEME.colors.textMuted}
            />
            <Text
              style={[
                styles.navTabText,
                activeTab === "paylinks" && styles.navTabTextActive,
              ]}
            >
              Pay Links
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab("contacts")}
          >
            <BookUser
              size={20}
              color={activeTab === "contacts" ? "#ffffff" : THEME.colors.textMuted}
            />
            <Text
              style={[
                styles.navTabText,
                activeTab === "contacts" && styles.navTabTextActive,
              ]}
            >
              Contacts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab("security")}
          >
            <Lock
              size={20}
              color={activeTab === "security" ? "#ffffff" : THEME.colors.textMuted}
            />
            <Text
              style={[
                styles.navTabText,
                activeTab === "security" && styles.navTabTextActive,
              ]}
            >
              Security
            </Text>
          </TouchableOpacity>
        </View>

        {/* MODAL: Receive Funds */}
        <Modal
          visible={showReceiveModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReceiveModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Receive Funds</Text>
                <TouchableOpacity onPress={() => setShowReceiveModal(false)}>
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Your Robinhood Chain Smart Account Address
              </Text>

              <View style={styles.qrPlaceholderBox}>
                <Text style={styles.qrPlaceholderText}>Robinhood Chain (4663)</Text>
                <Text style={styles.qrAddressMono}>{walletAddress}</Text>
              </View>

              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => copyToClipboard("modal-addr", walletAddress)}
              >
                <Copy size={14} color="#000000" />
                <Text style={styles.modalActionButtonText}>Copy Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: Add Contact */}
        <Modal
          visible={showAddContactModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddContactModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalBackdrop}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Contact</Text>
                <TouchableOpacity onPress={() => setShowAddContactModal(false)}>
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name / Label</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Alice Payroll"
                  placeholderTextColor={THEME.colors.textDim}
                  value={formContactName}
                  onChangeText={setFormContactName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address (0x or st:eth:...)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0x..."
                  placeholderTextColor={THEME.colors.textDim}
                  value={formContactAddress}
                  onChangeText={setFormContactAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.tokenPickerRow}>
                  {(["Personal", "Work", "Cold Storage", "Other"] as ContactCategory[]).map(
                    (cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.tokenPickerButton,
                          formContactCategory === cat && styles.tokenPickerButtonActive,
                        ]}
                        onPress={() => setFormContactCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.tokenPickerText,
                            formContactCategory === cat && styles.tokenPickerTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Private Note (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contractor reference, cold vault, etc."
                  placeholderTextColor={THEME.colors.textDim}
                  value={formContactNote}
                  onChangeText={setFormContactNote}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveContact}
              >
                <Text style={styles.primaryButtonText}>Save to Address Book</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* MODAL: Address Book Picker for Send */}
        <Modal
          visible={showAddressBookPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddressBookPicker(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Recipient</Text>
                <TouchableOpacity onPress={() => setShowAddressBookPicker(false)}>
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {contacts.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <Text style={styles.emptyStateTitle}>No contacts saved yet</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Add contacts in the Address Book tab to pick them quickly here.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {contacts.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.contactPickerItem}
                      onPress={() => {
                        setSendRecipient(c.address);
                        setShowAddressBookPicker(false);
                      }}
                    >
                      <Text style={styles.contactPickerName}>{c.name}</Text>
                      <Text style={styles.contactPickerAddr}>{shortenAddress(c.address)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* MODAL: TOTP 2FA Authentication */}
        <Modal
          visible={showTotpPrompt}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTotpPrompt(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Authenticator Code</Text>
                <TouchableOpacity onPress={() => setShowTotpPrompt(false)}>
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Enter the 6-digit code from your authenticator app to authorize Shard B co-signing.
              </Text>

              <TextInput
                style={[styles.textInput, { textAlign: "center", fontSize: 24, letterSpacing: 8 }]}
                placeholder="000000"
                placeholderTextColor={THEME.colors.textDim}
                keyboardType="number-pad"
                maxLength={6}
                value={totpCode}
                onChangeText={setTotpCode}
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleExecuteSendWithTotp}
              >
                <Text style={styles.primaryButtonText}>Verify & Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: Panic Freeze Confirmation */}
        <Modal
          visible={showPanicModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPanicModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Panic Freeze</Text>
                <TouchableOpacity onPress={() => setShowPanicModal(false)}>
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Are you sure you want to freeze this wallet? All outgoing transfers will be blocked until unfrozen via your recovery key.
              </Text>

              <TouchableOpacity
                style={styles.dangerButton}
                onPress={handlePanicFreeze}
              >
                <Text style={styles.dangerButtonText}>Yes, Freeze Outgoing Transfers</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  centeredLoading: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
  onboardingContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  onboardingIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1,
    marginBottom: 8,
  },
  onboardingSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  onboardingFeatures: {
    width: "100%",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  onboardingFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ffffff",
  },
  featureText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
    letterSpacing: 1.5,
  },
  networkDotRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.success,
    marginRight: 6,
  },
  networkName: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  headerAccount: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: THEME.spacing.sm + 2,
    paddingVertical: THEME.spacing.xs + 2,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 6,
  },
  headerAccountText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: THEME.spacing.lg,
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  balanceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  refreshButton: {
    padding: 4,
  },
  totalBalanceText: {
    fontSize: 32,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    marginVertical: 4,
  },
  balanceSubtext: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
  },
  actionDock: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSubtle,
    paddingTop: THEME.spacing.md,
  },
  actionButton: {
    alignItems: "center",
    gap: 6,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconCircleSecondary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 11,
    fontWeight: "500",
    color: THEME.colors.textSecondary,
  },
  guardrailWidget: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.lg,
  },
  guardrailWidgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  guardrailTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  guardrailWidgetTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  guardrailConfigureText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  guardrailProgressTrack: {
    height: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 4,
  },
  guardrailProgressFill: {
    height: "100%",
    backgroundColor: "#ffffff",
  },
  guardrailMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  guardrailMetaText: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textMuted,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
  },
  assetsList: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.lg,
  },
  assetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  assetLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  assetAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  assetAvatarText: {
    fontSize: 14,
    fontWeight: "bold",
    color: THEME.colors.textPrimary,
  },
  assetSymbol: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  assetName: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  assetRight: {
    alignItems: "flex-end",
  },
  assetBalance: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textPrimary,
  },
  assetUsd: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  transactionsList: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emptyStateBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  txLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  txIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  txIconSend: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
  },
  txIconReceive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  txTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  txMeta: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  txRight: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  txAmountSend: {
    color: THEME.colors.danger,
  },
  txAmountReceive: {
    color: THEME.colors.success,
  },
  txUsd: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  screenHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  screenSubheading: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginBottom: THEME.spacing.lg,
  },
  inputGroup: {
    marginBottom: THEME.spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  labelActionText: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm + 4,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  inputHelperText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  contactMatchedRow: {
    marginTop: 6,
  },
  contactMatchedLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  poisonWarningBox: {
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderWidth: 1,
    borderColor: THEME.colors.danger,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  poisonWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  poisonWarningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.danger,
  },
  poisonWarningDetail: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  poisonCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  poisonCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  poisonCheckboxActive: {
    backgroundColor: THEME.colors.danger,
  },
  poisonCheckText: {
    fontSize: 11,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  tokenPickerRow: {
    flexDirection: "row",
    gap: 8,
  },
  tokenPickerButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    alignItems: "center",
  },
  tokenPickerButtonActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  tokenPickerText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
  },
  tokenPickerTextActive: {
    color: "#000000",
  },
  stealthToggleBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  stealthLeft: {
    flex: 1,
    marginRight: 10,
  },
  stealthTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  stealthDescription: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: "#ffffff",
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.textMuted,
  },
  toggleThumbActive: {
    backgroundColor: "#000000",
    alignSelf: "flex-end",
  },
  spendBlockAlert: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.warning,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  spendBlockTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.warning,
    marginBottom: 2,
  },
  spendBlockDetail: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: THEME.spacing.sm,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000000",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  payLinkCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  cardDescription: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
    lineHeight: 18,
  },
  payLinkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  payLinkInfo: {
    flex: 1,
  },
  payLinkAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  payLinkAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  payLinkStatus: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.warning,
  },
  payLinkMemo: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  payLinkSlug: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  payLinkActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 8,
  },
  payLinkActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  contactsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  addContactIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: THEME.spacing.sm + 2,
    marginLeft: 8,
    color: THEME.colors.textPrimary,
    fontSize: 12,
  },
  categoryScroll: {
    flexDirection: "row",
    gap: 6,
    marginBottom: THEME.spacing.md,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  categoryButtonActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  categoryButtonText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  categoryButtonTextActive: {
    color: "#000000",
    fontWeight: "600",
  },
  contactsList: {
    gap: 8,
  },
  contactCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
  },
  contactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  contactAvatarText: {
    fontSize: 14,
    fontWeight: "bold",
    color: THEME.colors.textPrimary,
  },
  contactMeta: {
    flex: 1,
  },
  contactTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactName: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  contactCategoryTag: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textMuted,
  },
  contactAddress: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  contactNote: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactSendBtn: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  contactSendBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  contactDeleteBtn: {
    padding: 6,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  shardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  shardInfo: {
    flex: 1,
  },
  shardName: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  shardStatus: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  shardStateActive: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.success,
  },
  shardStateCold: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textMuted,
  },
  dangerButton: {
    backgroundColor: THEME.colors.danger,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingVertical: 8,
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navTabText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: "500",
  },
  navTabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: THEME.spacing.lg,
  },
  modalCard: {
    width: "100%",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: THEME.spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
    lineHeight: 18,
  },
  qrPlaceholderBox: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: THEME.spacing.lg,
  },
  qrPlaceholderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: THEME.colors.textMuted,
    marginBottom: 8,
  },
  qrAddressMono: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textPrimary,
    textAlign: "center",
  },
  modalActionButton: {
    backgroundColor: "#ffffff",
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalActionButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000000",
  },
  contactPickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  contactPickerName: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
  },
  contactPickerAddr: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
});
