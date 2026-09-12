import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { CheckCircle2, Copy, Check, ExternalLink, Share2 } from "lucide-react-native";
import { THEME } from "../config/theme";
import { ROBINHOOD_CHAIN_NAME, ROBINHOOD_EXPLORER_URL } from "../config/chain";

export interface MobileTransactionReceipt {
  hash: string;
  amount: string;
  token: string;
  usdValue: string;
  recipient: string;
  recipientLabel?: string;
  timestamp: number;
  explorerUrl: string;
}

interface TransactionReceiptModalProps {
  visible: boolean;
  receipt: MobileTransactionReceipt | null;
  onClose: () => void;
  onSendAnother: () => void;
}

function formatReceiptTime(timestamp: number): string {
  const d = new Date(timestamp);
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function shortenHash(hash: string): string {
  if (!hash || hash.length <= 20) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function TransactionReceiptModal({
  visible,
  receipt,
  onClose,
  onSendAnother,
}: TransactionReceiptModalProps) {
  const [copied, setCopied] = useState(false);

  if (!receipt) return null;

  const copyHash = async () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    try {
      await Clipboard.setStringAsync(receipt.hash);
    } catch (err) {
      console.warn("Failed to copy tx hash:", err);
    }
  };

  const openExplorer = async () => {
    const url = receipt.explorerUrl || `${ROBINHOOD_EXPLORER_URL}/tx/${receipt.hash}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Cannot Open Explorer", url);
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      console.warn("Failed to open explorer:", err);
      Alert.alert("Cannot Open Explorer", url);
    }
  };

  const shareReceipt = async () => {
    const url = receipt.explorerUrl || `${ROBINHOOD_EXPLORER_URL}/tx/${receipt.hash}`;
    const summary = [
      `PRIVATUM - Transfer Broadcasted`,
      `${receipt.amount} ${receipt.token} to ${receipt.recipient}`,
      `Tx: ${receipt.hash}`,
      url,
    ].join("\n");
    try {
      await Share.share({ message: summary });
    } catch (err) {
      console.warn("Failed to share receipt:", err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Success header */}
          <View style={styles.successHeader}>
            <View style={styles.successBadge}>
              <CheckCircle2 size={28} color={THEME.colors.success} />
            </View>
            <Text style={styles.successTitle}>Transfer Broadcasted</Text>
            <Text style={styles.successSubtitle}>
              Submitted to {ROBINHOOD_CHAIN_NAME}
            </Text>
          </View>

          {/* Amount */}
          <View style={styles.amountBlock}>
            <Text style={styles.amountText}>
              -{receipt.amount} {receipt.token}
            </Text>
            <Text style={styles.amountUsd}>approx. ${receipt.usdValue} USD</Text>
            <Text style={styles.amountRecipient} numberOfLines={2}>
              to {receipt.recipientLabel || receipt.recipient}
            </Text>
          </View>

          {/* Detail rows */}
          <View style={styles.detailBlock}>
            <TouchableOpacity style={styles.detailRow} onPress={copyHash} activeOpacity={0.7}>
              <Text style={styles.detailLabel}>Transaction</Text>
              <View style={styles.detailValueRow}>
                <Text style={styles.detailValueMono}>{shortenHash(receipt.hash)}</Text>
                {copied ? (
                  <Check size={13} color={THEME.colors.success} />
                ) : (
                  <Copy size={13} color={THEME.colors.textMuted} />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Timestamp</Text>
              <Text style={styles.detailValue}>{formatReceiptTime(receipt.timestamp)}</Text>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network</Text>
              <Text style={styles.detailValue}>{ROBINHOOD_CHAIN_NAME}</Text>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Signed With</Text>
              <Text style={styles.detailValue}>Device Shard A</Text>
            </View>
          </View>

          {/* Share + Explorer */}
          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.shareButton} onPress={shareReceipt} activeOpacity={0.8}>
              <Share2 size={14} color={THEME.colors.textPrimary} />
              <Text style={styles.explorerButtonText}>Share Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton} onPress={openExplorer} activeOpacity={0.8}>
              <Text style={styles.explorerButtonText}>Explorer</Text>
              <ExternalLink size={14} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.ghostButton} onPress={onSendAnother} activeOpacity={0.8}>
              <Text style={styles.ghostButtonText}>Send Another</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: THEME.spacing.lg,
  },
  card: {
    width: "100%",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.lg,
  },
  successHeader: {
    alignItems: "center",
    marginBottom: THEME.spacing.lg,
  },
  successBadge: {
    width: 56,
    height: 56,
    borderRadius: THEME.borderRadius.lg,
    backgroundColor: THEME.colors.successMuted,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: THEME.spacing.md,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  successSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  amountBlock: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: THEME.spacing.lg,
    paddingHorizontal: THEME.spacing.md,
    alignItems: "center",
    marginBottom: THEME.spacing.md,
  },
  amountText: {
    fontSize: 24,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    fontFamily: "monospace",
  },
  amountUsd: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  amountRecipient: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 8,
    textAlign: "center",
    fontFamily: "monospace",
  },
  detailBlock: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    gap: THEME.spacing.md,
  },
  detailDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderSubtle,
  },
  detailLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
    flexShrink: 1,
    textAlign: "right",
  },
  detailValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  detailValueMono: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontFamily: "monospace",
  },
  shareRow: {
    flexDirection: "row",
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: THEME.colors.secondaryMuted,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
  },
  explorerButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: THEME.colors.secondaryMuted,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  explorerButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  actionRow: {
    flexDirection: "row",
    gap: THEME.spacing.sm,
  },
  ghostButton: {
    flex: 1,
    backgroundColor: THEME.colors.secondaryMuted,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
  },
  doneButton: {
    flex: 1,
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: THEME.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
