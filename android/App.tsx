import "./src/lib/polyfills";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
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
  RefreshControl,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { BlurView } from "expo-blur";
import {
  Home,
  Shield,
  ShieldAlert,
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
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Key,
  Settings,
  Sliders,
  Server,
  ExternalLink,
  QrCode,
} from "lucide-react-native";

import {
  ROBINHOOD_CHAIN_NAME,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_RPC_URL,
  PRIVATUM_FACTORY_ADDRESS,
  USDG_TOKEN_ADDRESS,
  ROBINHOOD_EXPLORER_URL,
  PUBLIC_APP_URL,
} from "./src/config/chain";
import {
  createRealMobilePayLink,
  fetchMobilePayLinks,
  checkAndSweepMobilePayLink,
} from "./src/lib/paylinks";
import { executeMobileSend } from "./src/lib/execute";
import {
  TransactionReceiptModal,
  type MobileTransactionReceipt,
} from "./src/components/TransactionReceiptModal";
import {
  getMobileFreezeState,
  freezeMobileWallet,
  unfreezeMobileWallet,
} from "./src/lib/freeze";
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
  DEFAULT_GUARDRAIL_CONFIG,
  loadMobileGuardrails,
  saveMobileGuardrails,
  evaluateSpend,
  get24hSpendTotal,
  estimateUsdValue,
  type SpendingGuardrailConfig,
  type SpendingRecord,
  type GuardrailVerdict,
} from "./src/lib/spendGuardrails";
import {
  loadMobileContacts,
  saveMobileContacts,
  addMobileContact,
  deleteMobileContact,
  findMobileContactByAddress,
  searchMobileContacts,
  recordMobileContactUsage,
  getRecentMobileContacts,
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
  loadStoredRecoveryKey,
  resetAllAppData,
  type LiveBalance,
  type LiveTransaction,
  type MobilePayLink,
} from "./src/lib/wallet";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TabKey = "home" | "paylinks" | "contacts" | "settings";
type SettingsSubPage = null | "keys" | "guardrails" | "security" | "network" | "data";

const CATEGORIES: (ContactCategory | "All")[] = [
  "All",
  "Personal",
  "Work",
  "Exchange",
  "Cold Storage",
  "Other",
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [settingsSubPage, setSettingsSubPage] = useState<SettingsSubPage>(null);
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [sendReceipt, setSendReceipt] = useState<MobileTransactionReceipt | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<LiveBalance | null>(null);
  const [showAssetDrawer, setShowAssetDrawer] = useState<boolean>(false);

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
  const [isCreatingPayLink, setIsCreatingPayLink] = useState(false);
  const [checkingPayLinkSlug, setCheckingPayLinkSlug] = useState<string | null>(null);
  const [expandedQrSlug, setExpandedQrSlug] = useState<string | null>(null);

  // Send Form State
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendToken, setSendToken] = useState("USDG");
  const [sendAmount, setSendAmount] = useState("");
  const [isStealth, setIsStealth] = useState(false);
  const [poisonWarningAcknowledged, setPoisonWarningAcknowledged] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Freeze & Panic States
  const [isWalletFrozen, setIsWalletFrozen] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);
  const [showUnfreezeModal, setShowUnfreezeModal] = useState(false);
  const [unfreezeCode, setUnfreezeCode] = useState("");
  const [isUnfreezing, setIsUnfreezing] = useState(false);

  // Modals
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAddressBookPicker, setShowAddressBookPicker] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showTotpPrompt, setShowTotpPrompt] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRecoveryBackupModal, setShowRecoveryBackupModal] = useState(false);
  const [recoveryKeyToDisplay, setRecoveryKeyToDisplay] = useState<string>("");
  const [recoveryBackupConfirmed, setRecoveryBackupConfirmed] = useState(false);
  const [isGuardrailsOpen, setIsGuardrailsOpen] = useState(false);
  const [importAddressInput, setImportAddressInput] = useState("");
  const [totpCode, setTotpCode] = useState("");

  // Contact Form State
  const [formContactName, setFormContactName] = useState("");
  const [formContactAddress, setFormContactAddress] = useState("");
  const [formContactCategory, setFormContactCategory] = useState<ContactCategory>("Personal");
  const [formContactNote, setFormContactNote] = useState("");

  // Copied indicator
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Refresh live balances from Robinhood Chain RPC & freeze state from Co-Signer
  const syncBalances = useCallback(async (addr: string) => {
    if (!addr) return;
    setIsRefreshing(true);
    try {
      const [live, freezeInfo] = await Promise.all([
        fetchAllLiveBalances(addr),
        getMobileFreezeState(addr),
      ]);
      setBalances(live);
      setIsWalletFrozen(freezeInfo.frozen);
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

          // Load real live balances from Robinhood Chain RPC and freeze status
          await syncBalances(savedAccount);

          // Load real stored transactions
          const txs = await loadStoredTransactions(savedAccount);
          setTransactions(txs);

          // Load real paylinks from Co-Signer backend
          const links = await fetchMobilePayLinks(savedAccount);
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

  const copyToClipboard = async (key: string, text: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", "Address copied to clipboard.");
    } catch (err) {
      console.warn("Failed to copy:", err);
    }
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

  const recentContacts = useMemo(
    () => getRecentMobileContacts(contacts, 3),
    [contacts]
  );

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return searchMobileContacts(contacts, contactSearch, selectedCategory);
  }, [contacts, contactSearch, selectedCategory]);

  const handleManualRefresh = () => {
    if (walletAddress) {
      syncBalances(walletAddress);
      Alert.alert("Balances Synced", "Updated balances from Robinhood Chain.");
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
      setRecoveryKeyToDisplay(created.shardCKey);
      setRecoveryBackupConfirmed(false);
      setShowRecoveryBackupModal(true);
    } catch (err: any) {
      Alert.alert("Creation Error", err?.message || "Failed to register smart account.");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleViewRecoveryKey = async () => {
    if (!walletAddress) return;
    const key = await loadStoredRecoveryKey(walletAddress);
    if (key) {
      setRecoveryKeyToDisplay(key);
      setShowRecoveryBackupModal(true);
    } else {
      Alert.alert("Recovery Key", "No stored recovery key found on this device.");
    }
  };

  const handleOpenAssetDrawer = (asset: LiveBalance) => {
    setSelectedAsset(asset);
    setShowAssetDrawer(true);
  };

  const handleResetApp = () => {
    Alert.alert(
      "Reset Application",
      "This will permanently erase all local shards, saved contacts, and transaction history from this device. Make sure you have recorded your Shard C recovery key.\n\nAre you sure you want to proceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: async () => {
            try {
              await resetAllAppData(walletAddress);
              setWalletAddress("");
              setHasShardA(false);
              setBalances([
                { symbol: "USDG", name: "Robinhood USD", balance: "0.00", usdValue: "0.00" },
                { symbol: "ETH", name: "Ethereum", balance: "0.0000", usdValue: "0.00" },
              ]);
              setTransactions([]);
              setContacts([]);
              setPayLinks([]);
              setActiveTab("home");
              setSettingsSubPage(null);
              setShowAssetDrawer(false);
              setShowSendModal(false);
              Alert.alert("App Reset", "Local application data and shards have been wiped.");
            } catch (err: any) {
              Alert.alert("Reset Error", err?.message || "Failed to reset application.");
            }
          },
        },
      ]
    );
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
    if (!walletAddress) {
      Alert.alert("No Account", "Please create or connect a smart account first.");
      return;
    }
    if (!newPayLinkAmount || parseFloat(newPayLinkAmount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid requested amount.");
      return;
    }

    setIsCreatingPayLink(true);
    try {
      const newLink = await createRealMobilePayLink(walletAddress, {
        token: newPayLinkToken,
        amount: newPayLinkAmount,
        memo: newPayLinkMemo,
      });

      setPayLinks((prev) => [newLink, ...prev.filter((l) => l.slug !== newLink.slug)]);
      setNewPayLinkAmount("");
      setNewPayLinkMemo("");
      Alert.alert(
        "Payment Link Created",
        `Generated live disposable payment link on Robinhood Chain:\n\nhttps://privatumrh.com/pay/${newLink.slug}`
      );
    } catch (err: any) {
      Alert.alert("Pay Link Error", err?.message || "Failed to create pay link on backend.");
    } finally {
      setIsCreatingPayLink(false);
    }
  };

  const handleCheckAndSweep = async (slug: string) => {
    setCheckingPayLinkSlug(slug);
    try {
      const result = await checkAndSweepMobilePayLink(slug);
      if (result.swept) {
        Alert.alert(
          "Payment Swept",
          `Payment confirmed! Funds have been swept into your smart account on Robinhood Chain.${
            result.txHash ? `\nTx: ${shortenAddress(result.txHash)}` : ""
          }`
        );
        if (walletAddress) {
          await syncBalances(walletAddress);
          const links = await fetchMobilePayLinks(walletAddress);
          setPayLinks(links);
        }
      } else {
        Alert.alert(
          "Link Status: " + (result.status === "active" ? "Waiting for Deposit" : result.status),
          "The ephemeral burner address has not received a deposit on Robinhood Chain yet."
        );
      }
    } catch (err: any) {
      Alert.alert("Sweep Check Error", err?.message || "Failed to check payment status.");
    } finally {
      setCheckingPayLinkSlug(null);
    }
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
    if (!walletAddress) {
      Alert.alert("No Account", "Please connect or create a smart account first.");
      return;
    }
    if (isWalletFrozen) {
      Alert.alert(
        "Wallet Frozen",
        "Your wallet is currently frozen on the Co-Signer. Outgoing transfers are locked. Please unfreeze before sending."
      );
      return;
    }
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

  const handleExecuteSend = async () => {
    if (!walletAddress) {
      Alert.alert("No Account", "Please connect or create a smart account first.");
      return;
    }
    if (isWalletFrozen) {
      Alert.alert("Wallet Frozen", "Your wallet is currently frozen. Outgoing transfers are blocked.");
      return;
    }

    setIsSending(true);
    setShowTotpPrompt(false);

    try {
      const result = await executeMobileSend({
        walletAddress,
        recipient: sendRecipient,
        amount: sendAmount,
        token: sendToken,
      });

      const newTx: LiveTransaction = {
        id: `tx-${Date.now()}`,
        type: "send",
        token: sendToken,
        amount: parseFloat(sendAmount).toFixed(4),
        usdValue: estimateUsdValue(sendAmount, sendToken).toFixed(2),
        counterparty: sendRecipient,
        timestamp: Date.now(),
        hash: result.txHash,
      };

      const newRecord: SpendingRecord = {
        txHash: result.txHash,
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

      // Stamp the recipient as recently used for the quick-send strip (v0.1.16)
      const refreshedContacts = await recordMobileContactUsage(walletAddress, sendRecipient);
      setContacts(refreshedContacts);

      // Signed TX receipt (v0.1.15) - snapshot before the form is cleared
      setSendReceipt({
        hash: result.txHash,
        amount: newTx.amount,
        token: sendToken,
        usdValue: newTx.usdValue,
        recipient: sendRecipient,
        recipientLabel: matchedContact
          ? `${matchedContact.name} (${shortenAddress(sendRecipient)})`
          : undefined,
        timestamp: newTx.timestamp,
        explorerUrl: result.explorerUrl,
      });
      setSendAmount("");
      setSendRecipient("");
      setTotpCode("");
      setPoisonWarningAcknowledged(false);
      setShowSendModal(false);
      setActiveTab("home");

      // Re-fetch live on-chain balances
      if (walletAddress) {
        await syncBalances(walletAddress);
      }
    } catch (err: any) {
      console.error("[send] Failed to broadcast transaction:", err);
      Alert.alert(
        "Transfer Failed",
        err?.message || "Failed to broadcast transaction on Robinhood Chain."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handlePanicFreeze = async () => {
    if (!walletAddress) return;
    setIsFreezing(true);
    try {
      await freezeMobileWallet(walletAddress, 24);
      setIsWalletFrozen(true);
      setShowPanicModal(false);
      Alert.alert(
        "Wallet Frozen",
        "Emergency freeze activated on Co-Signer. Shard B is locked against outgoing transfers."
      );
    } catch (err: any) {
      Alert.alert("Freeze Error", err?.message || "Failed to activate emergency freeze on Co-Signer.");
    } finally {
      setIsFreezing(false);
    }
  };

  const handleUnfreeze = async () => {
    if (!walletAddress) return;
    if (!unfreezeCode || unfreezeCode.trim().length !== 6) {
      Alert.alert("Invalid Code", "Please enter your 6-digit authenticator code.");
      return;
    }
    setIsUnfreezing(true);
    try {
      await unfreezeMobileWallet(walletAddress, unfreezeCode.trim());
      setIsWalletFrozen(false);
      setShowUnfreezeModal(false);
      setUnfreezeCode("");
      Alert.alert("Wallet Unfrozen", "Emergency freeze lifted. Transfers are now permitted.");
    } catch (err: any) {
      Alert.alert("Unfreeze Error", err?.message || "Failed to unfreeze wallet.");
    } finally {
      setIsUnfreezing(false);
    }
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
            <View style={styles.onboardingLogoBox}>
              <Image
                source={require("./assets/logo.png")}
                style={styles.onboardingLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.onboardingTitle}>PRIVATUM</Text>
            <Text style={styles.onboardingSubtitle}>
              Private self-custody on Robinhood Chain.
            </Text>

            <View style={styles.onboardingFeatures}>
              <View style={styles.onboardingFeatureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>Hardware key protection on your device</Text>
              </View>
              <View style={styles.onboardingFeatureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>Two-factor authorization for transfers</Text>
              </View>
              <View style={styles.onboardingFeatureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>Transfer limits and fake address alerts</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateAccount}
              disabled={isCreatingAccount}
            >
              {isCreatingAccount ? (
                <ActivityIndicator size="small" color="#ffffff" />
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
                  Enter your smart account address to view balances and activity on Robinhood Chain.
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
          <View style={styles.headerBrandRow}>
            <Image
              source={require("./assets/logo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>PRIVATUM</Text>
          </View>

          <View style={styles.headerRightRow}>
            <Image
              source={require("./assets/rh-icon.png")}
              style={styles.networkRhLogo}
              resizeMode="contain"
            />
            <Text style={styles.networkName}>Robinhood Chain</Text>
          </View>
        </View>

        {/* Main Content Area */}
        <View style={styles.content}>
          {/* TAB 1: HOME */}
          {activeTab === "home" && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={async () => {
                    if (walletAddress) {
                      await syncBalances(walletAddress);
                    }
                  }}
                  tintColor={THEME.colors.accent}
                />
              }
            >
              {/* Emergency Frozen Banner */}
              {isWalletFrozen && (
                <View style={styles.frozenBanner}>
                  <View style={styles.frozenBannerHeader}>
                    <ShieldAlert size={16} color={THEME.colors.danger} />
                    <Text style={styles.frozenBannerTitle}>Account Frozen</Text>
                  </View>
                  <Text style={styles.frozenBannerText}>
                    Co-Signer Shard B is locked against outgoing transfers. Tap below to lift freeze.
                  </Text>
                  <TouchableOpacity
                    style={styles.frozenBannerBtn}
                    onPress={() => setShowUnfreezeModal(true)}
                  >
                    <Text style={styles.frozenBannerBtnText}>Unfreeze Wallet</Text>
                  </TouchableOpacity>
                </View>
              )}

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
                <Text style={styles.balanceSubtext}>Live balance on Robinhood Chain</Text>

                {/* Quick Action Dock */}
                <View style={styles.actionDock}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowSendModal(true)}
                  >
                    <View style={styles.actionIconCircle}>
                      <ArrowUpRight size={18} color="#ffffff" />
                    </View>
                    <Text style={styles.actionText}>Send</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowReceiveModal(true)}
                  >
                    <View style={styles.actionIconCircleSecondary}>
                      <ArrowDownLeft size={18} color="#000000" />
                    </View>
                    <Text style={styles.actionText}>Receive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setActiveTab("paylinks")}
                  >
                    <View style={styles.actionIconCircleSecondary}>
                      <Link2 size={18} color="#000000" />
                    </View>
                    <Text style={styles.actionText}>Pay Links</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setActiveTab("contacts")}
                  >
                    <View style={styles.actionIconCircleSecondary}>
                      <BookUser size={18} color="#000000" />
                    </View>
                    <Text style={styles.actionText}>Contacts</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* In-App Spending Guardrail Accordion */}
              <View style={styles.guardrailWidget}>
                <TouchableOpacity
                  style={styles.guardrailWidgetHeader}
                  onPress={() => setIsGuardrailsOpen(!isGuardrailsOpen)}
                  activeOpacity={0.7}
                >
                  <View style={styles.guardrailTitleRow}>
                    <Shield size={14} color={THEME.colors.accent} />
                    <Text style={styles.guardrailWidgetTitle}>Spending Guardrails</Text>
                  </View>
                  <View style={styles.guardrailHeaderRight}>
                    <Text style={styles.guardrailSummaryText}>
                      ${current24hSpend.toFixed(0)} / ${guardrailConfig.dailyLimitUsd.toFixed(0)}
                    </Text>
                    {isGuardrailsOpen ? (
                      <ChevronUp size={16} color={THEME.colors.textSecondary} />
                    ) : (
                      <ChevronDown size={16} color={THEME.colors.textSecondary} />
                    )}
                  </View>
                </TouchableOpacity>

                {isGuardrailsOpen && (
                  <View style={styles.guardrailAccordionBody}>
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
                        ${guardrailConfig.dailyLimitUsd.toFixed(2)} limit
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.guardrailConfigureBtn}
                      onPress={() => {
                        setActiveTab("settings");
                        setSettingsSubPage("guardrails");
                      }}
                    >
                      <Text style={styles.guardrailConfigureText}>Configure Limit Settings</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Real Token Assets */}
              <Text style={styles.sectionHeader}>Assets (On-Chain)</Text>
              <View style={styles.assetsList}>
                {balances.map((item) => (
                  <TouchableOpacity
                    key={item.symbol}
                    style={styles.assetRow}
                    onPress={() => handleOpenAssetDrawer(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.assetLeft}>
                      <Image
                        source={
                          item.symbol === "USDG"
                            ? require("./assets/usdg_logo.png")
                            : require("./assets/eth.jpeg")
                        }
                        style={styles.tokenAssetIcon}
                        resizeMode="contain"
                      />
                      <View>
                        <Text style={styles.assetSymbol}>{item.symbol}</Text>
                        <Text style={styles.assetName}>{item.name}</Text>
                      </View>
                    </View>
                    <View style={styles.assetRight}>
                      <Text style={styles.assetBalance}>{item.balance}</Text>
                      <Text style={styles.assetUsd}>${item.usdValue}</Text>
                    </View>
                  </TouchableOpacity>
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

          {/* TAB 2: PAY LINKS */}
          {activeTab === "paylinks" && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={async () => {
                    setIsRefreshing(true);
                    if (walletAddress) {
                      const links = await fetchMobilePayLinks(walletAddress);
                      setPayLinks(links);
                    }
                    setIsRefreshing(false);
                  }}
                  tintColor={THEME.colors.accent}
                />
              }
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
                        <Image
                          source={
                            sym === "USDG"
                              ? require("./assets/usdg_logo.png")
                              : require("./assets/eth.jpeg")
                          }
                          style={styles.tokenPickerIcon}
                          resizeMode="contain"
                        />
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
                  style={[styles.primaryButton, isCreatingPayLink && { opacity: 0.7 }]}
                  onPress={handleCreatePayLink}
                  disabled={isCreatingPayLink}
                >
                  {isCreatingPayLink ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Generate Payment Link</Text>
                  )}
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
                  <View key={link.id} style={styles.payLinkCardWrap}>
                    <View style={styles.payLinkRowInner}>
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
                      <Text style={styles.payLinkSlug}>privatumrh.com/pay/{link.slug}</Text>
                    </View>

                    <View style={styles.payLinkActions}>
                      <TouchableOpacity
                        style={styles.payLinkActionBtn}
                        onPress={() => handleCheckAndSweep(link.slug)}
                        disabled={checkingPayLinkSlug === link.slug}
                      >
                        {checkingPayLinkSlug === link.slug ? (
                          <ActivityIndicator size="small" color={THEME.colors.accent} />
                        ) : (
                          <RefreshCw size={14} color={THEME.colors.textPrimary} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.payLinkActionBtn}
                        onPress={() =>
                          copyToClipboard(link.id, `https://privatumrh.com/pay/${link.slug}`)
                        }
                      >
                        <Copy size={14} color={THEME.colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.payLinkActionBtn}
                        onPress={() =>
                          Share.share({
                            message: `Pay ${link.amount} ${link.token} privately on Robinhood Chain: https://privatumrh.com/pay/${link.slug}`,
                          })
                        }
                      >
                        <Share2 size={14} color={THEME.colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.payLinkActionBtn,
                          expandedQrSlug === link.slug && styles.payLinkActionBtnActive,
                        ]}
                        onPress={() =>
                          setExpandedQrSlug(expandedQrSlug === link.slug ? null : link.slug)
                        }
                      >
                        <QrCode
                          size={14}
                          color={
                            expandedQrSlug === link.slug
                              ? THEME.colors.background
                              : THEME.colors.textPrimary
                          }
                        />
                      </TouchableOpacity>
                    </View>
                    </View>

                    {expandedQrSlug === link.slug && (
                      <View style={styles.payLinkQrPanel}>
                        <View style={styles.payLinkQrWrapper}>
                          <QRCode
                            value={`https://privatumrh.com/pay/${link.slug}`}
                            size={150}
                            color="#000000"
                            backgroundColor="#ffffff"
                          />
                        </View>
                        <Text style={styles.payLinkQrCaption}>
                          Scan to pay {link.amount} {link.token}
                        </Text>
                      </View>
                    )}
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
                            setShowSendModal(true);
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

          {/* TAB 4: SETTINGS (MULTI-PAGE) */}
          {activeTab === "settings" && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {settingsSubPage === null ? (
                <>
                  <Text style={styles.screenHeading}>Settings</Text>
                  <Text style={styles.screenSubheading}>
                    Security, guardrails, network infrastructure, and device data
                  </Text>

                  <View style={styles.settingsGroup}>
                    {/* 1. Key Shards & Recovery */}
                    <TouchableOpacity
                      style={styles.settingsRow}
                      onPress={() => setSettingsSubPage("keys")}
                    >
                      <View style={styles.settingsRowIconBox}>
                        <Key size={18} color="#ffffff" />
                      </View>
                      <View style={styles.settingsRowTextCol}>
                        <Text style={styles.settingsRowTitle}>Key Shards & Recovery</Text>
                        <Text style={styles.settingsRowSubtitle}>
                          2-of-3 threshold state and emergency Shard C recovery key
                        </Text>
                      </View>
                      <ChevronRight size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>

                    {/* 2. Spending Guardrails */}
                    <TouchableOpacity
                      style={styles.settingsRow}
                      onPress={() => setSettingsSubPage("guardrails")}
                    >
                      <View style={styles.settingsRowIconBox}>
                        <Sliders size={18} color="#ffffff" />
                      </View>
                      <View style={styles.settingsRowTextCol}>
                        <Text style={styles.settingsRowTitle}>Spending Guardrails</Text>
                        <Text style={styles.settingsRowSubtitle}>
                          Single-transfer caps, daily limits, and velocity protections
                        </Text>
                      </View>
                      <ChevronRight size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>

                    {/* 3. Security & Panic Controls */}
                    <TouchableOpacity
                      style={styles.settingsRow}
                      onPress={() => setSettingsSubPage("security")}
                    >
                      <View style={styles.settingsRowIconBox}>
                        <Lock size={18} color="#ffffff" />
                      </View>
                      <View style={styles.settingsRowTextCol}>
                        <Text style={styles.settingsRowTitle}>Security & Panic Controls</Text>
                        <Text style={styles.settingsRowSubtitle}>
                          Emergency freeze, panic locks, and TOTP authentication
                        </Text>
                      </View>
                      <ChevronRight size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>

                    {/* 4. Network & Contracts */}
                    <TouchableOpacity
                      style={styles.settingsRow}
                      onPress={() => setSettingsSubPage("network")}
                    >
                      <View style={styles.settingsRowIconBox}>
                        <Server size={18} color="#ffffff" />
                      </View>
                      <View style={styles.settingsRowTextCol}>
                        <Text style={styles.settingsRowTitle}>Network & Contracts</Text>
                        <Text style={styles.settingsRowSubtitle}>
                          Robinhood Chain RPC, Factory, and token contracts
                        </Text>
                      </View>
                      <ChevronRight size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>

                    {/* 5. Data & Reset */}
                    <TouchableOpacity
                      style={[styles.settingsRow, styles.settingsRowLast]}
                      onPress={() => setSettingsSubPage("data")}
                    >
                      <View style={[styles.settingsRowIconBox, styles.settingsRowIconBoxDanger]}>
                        <Trash2 size={18} color={THEME.colors.danger} />
                      </View>
                      <View style={styles.settingsRowTextCol}>
                        <Text style={[styles.settingsRowTitle, { color: THEME.colors.danger }]}>
                          Data & Reset
                        </Text>
                        <Text style={styles.settingsRowSubtitle}>
                          Wipe local device shards and reset application
                        </Text>
                      </View>
                      <ChevronRight size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.settingsFooterBox}>
                    <Text style={styles.settingsFooterText}>Privatum Mobile v0.1.14</Text>
                    <Text style={styles.settingsFooterSub}>Robinhood Chain (Chain ID: 4663)</Text>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.subpageBackBar}
                    onPress={() => setSettingsSubPage(null)}
                  >
                    <ChevronLeft size={18} color="#ffffff" />
                    <Text style={styles.subpageBackText}>Settings</Text>
                  </TouchableOpacity>

                  {/* SUBPAGE 1: KEYS */}
                  {settingsSubPage === "keys" && (
                    <>
                      <Text style={styles.screenHeading}>Key Shards & Recovery</Text>
                      <Text style={styles.screenSubheading}>
                        2-of-3 threshold smart account security architecture
                      </Text>

                      <View style={styles.card}>
                        <Text style={styles.cardHeaderTitle}>Threshold Shard Status</Text>

                        <View style={styles.shardRow}>
                          <View style={styles.shardInfo}>
                            <Text style={styles.shardName}>Device Key (Shard A)</Text>
                            <Text style={styles.shardStatus}>
                              {hasShardA ? "Protected in device secure storage" : "Not connected yet"}
                            </Text>
                          </View>
                          <Text style={hasShardA ? styles.shardStateActive : styles.shardStateCold}>
                            {hasShardA ? "Active" : "Pending"}
                          </Text>
                        </View>

                        <View style={styles.shardRow}>
                          <View style={styles.shardInfo}>
                            <Text style={styles.shardName}>Server Co-Signer (Shard B)</Text>
                            <Text style={styles.shardStatus}>
                              Online security co-signer ready
                            </Text>
                          </View>
                          <Text style={styles.shardStateActive}>Online</Text>
                        </View>

                        <View style={styles.shardRow}>
                          <View style={styles.shardInfo}>
                            <Text style={styles.shardName}>Emergency Recovery (Shard C)</Text>
                            <Text style={styles.shardStatus}>
                              Offline backup key for account recovery
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.viewRecoveryKeyBtn}
                            onPress={handleViewRecoveryKey}
                          >
                            <Text style={styles.viewRecoveryKeyText}>View Key</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}

                  {/* SUBPAGE 2: GUARDRAILS */}
                  {settingsSubPage === "guardrails" && (
                    <>
                      <Text style={styles.screenHeading}>Spending Guardrails</Text>
                      <Text style={styles.screenSubheading}>
                        Set protection caps for automated transaction approval
                      </Text>

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
                    </>
                  )}

                  {/* SUBPAGE 3: SECURITY & PANIC */}
                  {settingsSubPage === "security" && (
                    <>
                      <Text style={styles.screenHeading}>Security & Panic Controls</Text>
                      <Text style={styles.screenSubheading}>
                        Account freeze, panic locks, and Co-Signer protection
                      </Text>

                      <View style={styles.card}>
                        <Text style={styles.cardHeaderTitle}>
                          {isWalletFrozen ? "Account Currently Frozen" : "Emergency Panic Freeze"}
                        </Text>
                        <Text style={styles.cardDescription}>
                          {isWalletFrozen
                            ? "Shard B on the Co-Signer backend is currently locked against outgoing transfers."
                            : "Immediately locks Shard B on the Co-Signer against all outgoing transfers on Robinhood Chain."}
                        </Text>
                        {isWalletFrozen ? (
                          <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => setShowUnfreezeModal(true)}
                          >
                            <Shield size={14} color="#ffffff" />
                            <Text style={styles.primaryButtonText}>Unfreeze Wallet</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.dangerButton}
                            onPress={() => setShowPanicModal(true)}
                          >
                            <Lock size={14} color="#ffffff" />
                            <Text style={styles.dangerButtonText}>Freeze Wallet Now</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}

                  {/* SUBPAGE 4: NETWORK & CONTRACTS */}
                  {settingsSubPage === "network" && (
                    <>
                      <Text style={styles.screenHeading}>Network & Contracts</Text>
                      <Text style={styles.screenSubheading}>
                        Verified smart contract deployments on Robinhood Chain
                      </Text>

                      <View style={styles.card}>
                        <Text style={styles.cardHeaderTitle}>Robinhood Chain</Text>

                        <View style={styles.networkSpecRow}>
                          <Text style={styles.networkSpecLabel}>Chain ID</Text>
                          <Text style={styles.networkSpecValue}>{ROBINHOOD_CHAIN_ID}</Text>
                        </View>

                        <View style={styles.networkSpecDivider} />

                        <View style={styles.networkSpecRow}>
                          <Text style={styles.networkSpecLabel}>RPC Endpoint</Text>
                          <Text style={styles.networkSpecValue}>{ROBINHOOD_RPC_URL}</Text>
                        </View>

                        <View style={styles.networkSpecDivider} />

                        <View style={styles.networkSpecRow}>
                          <Text style={styles.networkSpecLabel}>Factory Contract</Text>
                          <TouchableOpacity
                            onPress={() => copyToClipboard("factory-ca", PRIVATUM_FACTORY_ADDRESS)}
                            style={styles.drawerCaCopyRow}
                          >
                            <Text style={styles.drawerCaText}>
                              {shortenAddress(PRIVATUM_FACTORY_ADDRESS)}
                            </Text>
                            <Copy size={12} color={THEME.colors.textSecondary} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.networkSpecDivider} />

                        <View style={styles.networkSpecRow}>
                          <Text style={styles.networkSpecLabel}>USDG Stablecoin</Text>
                          <TouchableOpacity
                            onPress={() => copyToClipboard("usdg-ca", USDG_TOKEN_ADDRESS)}
                            style={styles.drawerCaCopyRow}
                          >
                            <Text style={styles.drawerCaText}>
                              {shortenAddress(USDG_TOKEN_ADDRESS)}
                            </Text>
                            <Copy size={12} color={THEME.colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}

                  {/* SUBPAGE 5: DATA & RESET */}
                  {settingsSubPage === "data" && (
                    <>
                      <Text style={styles.screenHeading}>Data & Reset</Text>
                      <Text style={styles.screenSubheading}>
                        Local storage management and complete application reset
                      </Text>

                      <View style={styles.card}>
                        <Text style={styles.cardHeaderTitle}>Device Storage</Text>
                        <Text style={styles.cardDescription}>
                          All private keys and personal contacts are held strictly on your device inside hardware-backed secure storage.
                        </Text>
                      </View>

                      <View style={[styles.card, styles.dangerCardBorder]}>
                        <Text style={[styles.cardHeaderTitle, { color: THEME.colors.danger }]}>
                          Reset Application
                        </Text>
                        <Text style={styles.cardDescription}>
                          This will erase your device key shard, active account address, saved contacts, and transaction history from this phone.
                          {"\n\n"}
                          Make sure you have safely recorded your Shard C recovery key before continuing.
                        </Text>
                        <TouchableOpacity
                          style={styles.dangerButton}
                          onPress={handleResetApp}
                        >
                          <Trash2 size={14} color="#ffffff" />
                          <Text style={styles.dangerButtonText}>Reset All Local Data</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </View>

        {/* Floating Liquid Glass Pill Navigation Bar */}
        <View style={styles.floatingNavWrapper}>
          <BlurView
            intensity={Platform.OS === "ios" ? 70 : 40}
            tint="dark"
            style={styles.floatingNavPill}
          >
            <TouchableOpacity
              style={[styles.navTab, activeTab === "home" && styles.navTabActive]}
              onPress={() => setActiveTab("home")}
            >
              <Home
                size={18}
                color={activeTab === "home" ? THEME.colors.accent : THEME.colors.textMuted}
              />
              <Text
                style={[
                  styles.navTabText,
                  activeTab === "home" && styles.navTabTextActive,
                ]}
              >
                Home
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, activeTab === "paylinks" && styles.navTabActive]}
              onPress={() => setActiveTab("paylinks")}
            >
              <Link2
                size={18}
                color={activeTab === "paylinks" ? THEME.colors.accent : THEME.colors.textMuted}
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
              style={[styles.navTab, activeTab === "contacts" && styles.navTabActive]}
              onPress={() => setActiveTab("contacts")}
            >
              <BookUser
                size={18}
                color={activeTab === "contacts" ? THEME.colors.accent : THEME.colors.textMuted}
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
              style={[styles.navTab, activeTab === "settings" && styles.navTabActive]}
              onPress={() => {
                setActiveTab("settings");
                setSettingsSubPage(null);
              }}
            >
              <Settings
                size={18}
                color={activeTab === "settings" ? THEME.colors.accent : THEME.colors.textMuted}
              />
              <Text
                style={[
                  styles.navTabText,
                  activeTab === "settings" && styles.navTabTextActive,
                ]}
              >
                Settings
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* MODAL: Token Asset Detail Drawer */}
        <Modal
          visible={showAssetDrawer}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAssetDrawer(false)}
        >
          <View style={styles.drawerBackdrop}>
            <View style={styles.drawerCard}>
              <View style={styles.drawerHandleBar} />

              <View style={styles.drawerHeaderRow}>
                <View style={styles.drawerHeaderLeft}>
                  <Image
                    source={
                      selectedAsset?.symbol === "USDG"
                        ? require("./assets/usdg_logo.png")
                        : require("./assets/eth.jpeg")
                    }
                    style={styles.drawerTokenIcon}
                    resizeMode="contain"
                  />
                  <View>
                    <Text style={styles.drawerTokenSymbol}>{selectedAsset?.symbol}</Text>
                    <Text style={styles.drawerTokenName}>{selectedAsset?.name}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.drawerCloseBtn}
                  onPress={() => setShowAssetDrawer(false)}
                >
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Price & Balance Box */}
              <View style={styles.drawerValueBox}>
                <Text style={styles.drawerValueLabel}>Your Balance</Text>
                <Text style={styles.drawerLargeValue}>
                  ${selectedAsset?.usdValue} <Text style={styles.drawerLargeValueSub}>USD</Text>
                </Text>
                <Text style={styles.drawerBalanceSub}>
                  {selectedAsset?.balance} {selectedAsset?.symbol}
                </Text>
              </View>

              {/* Specifications Card */}
              <View style={styles.drawerSpecCard}>
                <View style={styles.drawerSpecRow}>
                  <Text style={styles.drawerSpecLabel}>Unit Price</Text>
                  <Text style={styles.drawerSpecValue}>
                    {selectedAsset?.symbol === "USDG" ? "$1.00 USD (Pegged)" : "$2,500.00 USD"}
                  </Text>
                </View>

                <View style={styles.drawerSpecDivider} />

                <View style={styles.drawerSpecRow}>
                  <Text style={styles.drawerSpecLabel}>Contract Address (CA)</Text>
                  {selectedAsset?.symbol === "USDG" ? (
                    <TouchableOpacity
                      style={styles.drawerCaCopyRow}
                      onPress={() => copyToClipboard("usdg-ca", USDG_TOKEN_ADDRESS)}
                    >
                      <Text style={styles.drawerCaText}>
                        {shortenAddress(USDG_TOKEN_ADDRESS)}
                      </Text>
                      {copiedKey === "usdg-ca" ? (
                        <Check size={12} color={THEME.colors.success} />
                      ) : (
                        <Copy size={12} color={THEME.colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.drawerSpecValue}>Native Robinhood Chain</Text>
                  )}
                </View>

                <View style={styles.drawerSpecDivider} />

                <View style={styles.drawerSpecRow}>
                  <Text style={styles.drawerSpecLabel}>Network</Text>
                  <Text style={styles.drawerSpecValue}>Robinhood Chain</Text>
                </View>

                <View style={styles.drawerSpecDivider} />

                <View style={styles.drawerSpecRow}>
                  <Text style={styles.drawerSpecLabel}>Standard</Text>
                  <Text style={styles.drawerSpecValue}>
                    {selectedAsset?.symbol === "USDG" ? "ERC-20" : "Native Gas Token"}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.drawerActionRow}>
                <TouchableOpacity
                  style={styles.drawerPrimaryBtn}
                  onPress={() => {
                    if (selectedAsset) {
                      setSendToken(selectedAsset.symbol);
                    }
                    setShowAssetDrawer(false);
                    setShowSendModal(true);
                  }}
                >
                  <ArrowUpRight size={16} color="#ffffff" />
                  <Text style={styles.drawerPrimaryBtnText}>
                    Send {selectedAsset?.symbol}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerSecondaryBtn}
                  onPress={() => {
                    setShowAssetDrawer(false);
                    setShowReceiveModal(true);
                  }}
                >
                  <ArrowDownLeft size={16} color="#000000" />
                  <Text style={styles.drawerSecondaryBtnText}>Receive</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL: Send Funds */}
        <Modal
          visible={showSendModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSendModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.sendModalCard]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Send Tokens</Text>
                <TouchableOpacity onPress={() => setShowSendModal(false)}>
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Transfer authenticated on Robinhood Chain
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Recipient Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Recipient Address</Text>
                    <TouchableOpacity onPress={() => setShowAddressBookPicker(true)}>
                      <Text style={styles.labelActionText}>Address Book</Text>
                    </TouchableOpacity>
                  </View>
                  {recentContacts.length > 0 && (
                    <View style={styles.recentChipRow}>
                      {recentContacts.map((contact) => {
                        const isActive =
                          sendRecipient.trim().toLowerCase() ===
                          contact.address.trim().toLowerCase();
                        return (
                          <TouchableOpacity
                            key={contact.id}
                            style={[styles.recentChip, isActive && styles.recentChipActive]}
                            onPress={() => {
                              setSendRecipient(contact.address);
                              setPoisonWarningAcknowledged(false);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.recentChipText,
                                isActive && styles.recentChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {contact.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
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
                        <Image
                          source={
                            sym === "USDG"
                              ? require("./assets/usdg_logo.png")
                              : require("./assets/eth.jpeg")
                          }
                          style={styles.tokenPickerIcon}
                          resizeMode="contain"
                        />
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
                    (!sendRecipient || !sendAmount || isSending || isWalletFrozen) && styles.buttonDisabled,
                  ]}
                  disabled={!sendRecipient || !sendAmount || isSending || isWalletFrozen}
                  onPress={handleConfirmSend}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {isWalletFrozen ? "Wallet is Frozen" : "Authorize Transfer"}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL: Signed Transaction Receipt */}
        <TransactionReceiptModal
          visible={sendReceipt !== null}
          receipt={sendReceipt}
          onClose={() => setSendReceipt(null)}
          onSendAnother={() => {
            setSendReceipt(null);
            setShowSendModal(true);
          }}
        />


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
                Scan or copy your Robinhood Chain address
              </Text>

              <View style={styles.qrCodeContainer}>
                <View style={styles.qrCodeWrapper}>
                  <QRCode
                    value={walletAddress || "0x0000000000000000000000000000000000000000"}
                    size={170}
                    color="#000000"
                    backgroundColor="#ffffff"
                    logo={require("./assets/logo.png")}
                    logoSize={34}
                    logoBackgroundColor="#ffffff"
                    logoBorderRadius={8}
                  />
                </View>
                <Text style={styles.qrAddressMono}>{walletAddress}</Text>
              </View>

              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => copyToClipboard("receive-addr", walletAddress)}
              >
                <Copy size={16} color="#ffffff" />
                <Text style={styles.modalActionButtonText}>Copy Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: Shard C Emergency Recovery Key Backup */}
        <Modal
          visible={showRecoveryBackupModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (recoveryBackupConfirmed) setShowRecoveryBackupModal(false);
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.recoveryHeaderTitleRow}>
                  <Key size={18} color={THEME.colors.accent} />
                  <Text style={styles.modalTitle}>Emergency Recovery Key</Text>
                </View>
                <TouchableOpacity onPress={() => setShowRecoveryBackupModal(false)}>
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                This key is your emergency recovery backup. If you lose this device, you need this key to restore your funds. Write it down or save it safely offline.
              </Text>

              <View style={styles.recoveryKeyBox}>
                <Text style={styles.recoveryKeyMono} selectable>
                  {recoveryKeyToDisplay}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => copyToClipboard("recovery-key", recoveryKeyToDisplay)}
              >
                <Text style={styles.secondaryButtonText}>Copy Recovery Key</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recoveryCheckboxRow}
                onPress={() => setRecoveryBackupConfirmed(!recoveryBackupConfirmed)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.recoveryCheckbox,
                    recoveryBackupConfirmed && styles.recoveryCheckboxActive,
                  ]}
                >
                  {recoveryBackupConfirmed && <Check size={12} color="#ffffff" />}
                </View>
                <Text style={styles.recoveryCheckboxText}>
                  I have saved this emergency recovery key safely offline
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  !recoveryBackupConfirmed && styles.buttonDisabled,
                ]}
                disabled={!recoveryBackupConfirmed}
                onPress={() => setShowRecoveryBackupModal(false)}
              >
                <Text style={styles.primaryButtonText}>Complete Setup</Text>
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

        {/* MODAL: Confirm & Broadcast Transfer */}
        <Modal
          visible={showTotpPrompt}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTotpPrompt(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Transfer</Text>
                <TouchableOpacity onPress={() => setShowTotpPrompt(false)}>
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Review details before signing with your device shard and broadcasting to Robinhood Chain.
              </Text>

              <View style={styles.confirmTransferCard}>
                <View style={styles.confirmTransferRow}>
                  <Text style={styles.confirmTransferLabel}>Amount</Text>
                  <Text style={styles.confirmTransferValue}>
                    {sendAmount} {sendToken} (~${estimateUsdValue(sendAmount, sendToken).toFixed(2)} USD)
                  </Text>
                </View>
                <View style={styles.confirmTransferRow}>
                  <Text style={styles.confirmTransferLabel}>Recipient</Text>
                  <Text style={styles.confirmTransferValueMono}>
                    {shortenAddress(sendRecipient)}
                  </Text>
                </View>
                {matchedContact ? (
                  <View style={styles.confirmTransferRow}>
                    <Text style={styles.confirmTransferLabel}>Contact</Text>
                    <Text style={styles.confirmTransferValue}>{matchedContact.name}</Text>
                  </View>
                ) : null}
                <View style={styles.confirmTransferRow}>
                  <Text style={styles.confirmTransferLabel}>Network</Text>
                  <Text style={styles.confirmTransferValue}>Robinhood Chain</Text>
                </View>
                <View style={styles.confirmTransferRow}>
                  <Text style={styles.confirmTransferLabel}>Key Shard</Text>
                  <Text style={styles.confirmTransferValue}>Device Key (Shard A)</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isSending && styles.buttonDisabled]}
                onPress={handleExecuteSend}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign & Broadcast</Text>
                )}
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
                Are you sure you want to freeze this wallet? Shard B on the Co-Signer will immediately lock against all outgoing transfers.
              </Text>

              <TouchableOpacity
                style={[styles.dangerButton, isFreezing && styles.buttonDisabled]}
                onPress={handlePanicFreeze}
                disabled={isFreezing}
              >
                {isFreezing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.dangerButtonText}>Yes, Freeze Outgoing Transfers</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: Unfreeze Account */}
        <Modal
          visible={showUnfreezeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUnfreezeModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Unfreeze Account</Text>
                <TouchableOpacity onPress={() => setShowUnfreezeModal(false)}>
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Enter the 6-digit code from your authenticator app to lift the emergency freeze on the Co-Signer.
              </Text>

              <TextInput
                style={[styles.textInput, { textAlign: "center", fontSize: 24, letterSpacing: 8 }]}
                placeholder="000000"
                placeholderTextColor={THEME.colors.textDim}
                keyboardType="number-pad"
                maxLength={6}
                value={unfreezeCode}
                onChangeText={setUnfreezeCode}
              />

              <TouchableOpacity
                style={[styles.primaryButton, isUnfreezing && styles.buttonDisabled]}
                onPress={handleUnfreeze}
                disabled={isUnfreezing}
              >
                {isUnfreezing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Unlock Wallet</Text>
                )}
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
  onboardingLogoBox: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  onboardingLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: "hidden",
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
    backgroundColor: "#f54842",
  },
  featureText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000000",
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
  headerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: {
    width: 22,
    height: 22,
    borderRadius: 10,
    overflow: "hidden",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
    letterSpacing: 1.5,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  networkDotRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  networkRhLogo: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 6,
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
    paddingBottom: 110,
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
    backgroundColor: "#f54842",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconCircleSecondary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
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
  guardrailHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  guardrailSummaryText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  guardrailAccordionBody: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSubtle,
  },
  guardrailConfigureBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
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
  tokenAssetIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
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
  },
  inputHelperText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  recentChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  recentChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.secondaryMuted,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    maxWidth: 160,
  },
  recentChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderColor: THEME.colors.borderHighlight,
  },
  recentChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
  },
  recentChipTextActive: {
    color: THEME.colors.textPrimary,
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
    flexDirection: "row",
    gap: 6,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenPickerButtonActive: {
    backgroundColor: "#f54842",
    borderColor: "#f54842",
  },
  tokenPickerIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: "hidden",
  },
  tokenPickerText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
  },
  tokenPickerTextActive: {
    color: "#ffffff",
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
    backgroundColor: "#f54842",
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.textMuted,
  },
  toggleThumbActive: {
    backgroundColor: "#ffffff",
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
    backgroundColor: "#f54842",
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: THEME.spacing.sm,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
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
  payLinkCardWrap: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  payLinkRowInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  payLinkActionBtnActive: {
    backgroundColor: THEME.colors.textPrimary,
    borderColor: THEME.colors.textPrimary,
  },
  payLinkQrPanel: {
    alignItems: "center",
    marginTop: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSubtle,
  },
  payLinkQrWrapper: {
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: THEME.borderRadius.md,
  },
  payLinkQrCaption: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.sm,
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
    backgroundColor: "#f54842",
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
    backgroundColor: "#f54842",
    borderColor: "#f54842",
  },
  categoryButtonText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  categoryButtonTextActive: {
    color: "#ffffff",
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
  viewRecoveryKeyBtn: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewRecoveryKeyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000000",
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
  floatingNavWrapper: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 24 : 14,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  floatingNavPill: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 440,
    backgroundColor: Platform.OS === "ios" ? "rgba(20, 22, 30, 0.70)" : "rgba(18, 20, 28, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 36,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    elevation: 12,
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
    paddingVertical: 4,
  },
  navTabActive: {
    backgroundColor: "rgba(245, 72, 66, 0.12)",
    borderRadius: 20,
  },
  navTabText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: "500",
  },
  navTabTextActive: {
    color: "#f54842",
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
  recoveryHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  qrCodeContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: THEME.spacing.lg,
  },
  qrCodeWrapper: {
    padding: 14,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginBottom: 12,
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
  recoveryKeyBox: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  recoveryKeyMono: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textPrimary,
    lineHeight: 18,
  },
  recoveryCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 12,
  },
  recoveryCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  recoveryCheckboxActive: {
    backgroundColor: THEME.colors.accent,
    borderColor: THEME.colors.accent,
  },
  recoveryCheckboxText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  modalActionButton: {
    backgroundColor: "#f54842",
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
    color: "#ffffff",
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
  // Token Asset Detail Drawer Styles
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  drawerCard: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  drawerHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  drawerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  drawerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  drawerTokenIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
  },
  drawerTokenSymbol: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  drawerTokenName: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerValueBox: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.lg,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  drawerValueLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  drawerLargeValue: {
    fontSize: 24,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
  },
  drawerLargeValueSub: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
  },
  drawerBalanceSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  drawerSpecCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  drawerSpecRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  drawerSpecLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  drawerSpecValue: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontWeight: "500",
  },
  drawerSpecDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderSubtle,
    marginVertical: 4,
  },
  drawerCaCopyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  drawerCaText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: THEME.colors.textPrimary,
  },
  drawerActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  drawerPrimaryBtn: {
    flex: 1,
    backgroundColor: "#f54842",
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  drawerPrimaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  drawerSecondaryBtn: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  drawerSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000000",
  },
  // Send Modal Style
  sendModalCard: {
    maxHeight: "88%",
  },
  // Multi-page Settings Styles
  settingsGroup: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: "hidden",
    marginBottom: 16,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: THEME.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  settingsRowLast: {
    borderBottomWidth: 0,
  },
  settingsRowIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  settingsRowIconBoxDanger: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderColor: "rgba(244, 63, 94, 0.2)",
  },
  settingsRowTextCol: {
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  settingsRowSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  settingsFooterBox: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  settingsFooterText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textMuted,
  },
  settingsFooterSub: {
    fontSize: 10,
    color: THEME.colors.textDim,
    marginTop: 2,
  },
  subpageBackBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    paddingVertical: 4,
  },
  subpageBackText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  networkSpecRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  networkSpecLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  networkSpecValue: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontWeight: "500",
  },
  networkSpecDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderSubtle,
    marginVertical: 4,
  },
  dangerCardBorder: {
    borderColor: "rgba(244, 63, 94, 0.3)",
    marginTop: 12,
  },
  frozenBanner: {
    backgroundColor: "rgba(245, 72, 66, 0.08)",
    borderColor: "rgba(245, 72, 66, 0.35)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  frozenBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  frozenBannerTitle: {
    color: "#f54842",
    fontSize: 14,
    fontWeight: "700",
  },
  frozenBannerText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  frozenBannerBtn: {
    backgroundColor: "#f54842",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  frozenBannerBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  confirmTransferCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  confirmTransferRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  confirmTransferLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
  },
  confirmTransferValue: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  confirmTransferValueMono: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
