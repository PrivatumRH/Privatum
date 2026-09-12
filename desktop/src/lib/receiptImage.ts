import QRCode from "qrcode";
import type { TransactionReceipt } from "../components/TransactionReceiptCard";

const W = 1080;
const H = 1350;

const INK = {
  bg: "#0b0d12",
  panel: "#12151d",
  border: "rgba(255,255,255,0.10)",
  borderSoft: "rgba(255,255,255,0.06)",
  white: "#ffffff",
  slate: "#94a3b8",
  dim: "#64748b",
  accent: "#f64943",
  success: "#10b981",
};

const SANS = '600 28px "Segoe UI", system-ui, -apple-system, sans-serif';
const MONO = '500 28px "Cascadia Mono", Consolas, "Courier New", monospace';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  ctx.save();
  ctx.strokeStyle = INK.borderSoft;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/** Draws a label/value row and returns the y position for the next row. */
function row(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  opts: { mono?: boolean; color?: string } = {}
): number {
  ctx.textAlign = "left";
  ctx.font = '400 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = INK.slate;
  ctx.fillText(label, x, y);

  ctx.textAlign = "right";
  ctx.font = opts.mono ? MONO : SANS;
  ctx.fillStyle = opts.color || INK.white;
  ctx.fillText(value, x + width, y);

  return y + 62;
}

function formatStamp(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}  ${d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

function midTruncate(value: string, head: number, tail: number): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

/**
 * Renders a shareable PNG of a signed transaction receipt.
 * Drawn directly on a canvas so no DOM-capture dependency is required.
 */
export async function renderReceiptImage(
  receipt: TransactionReceipt,
  explorerUrl: string
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable in this environment.");

  // Background + accent glow
  ctx.fillStyle = INK.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 150, 0, W / 2, 150, 620);
  glow.addColorStop(0, "rgba(246,73,67,0.16)");
  glow.addColorStop(1, "rgba(246,73,67,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 700);

  const M = 80;
  const innerW = W - M * 2;

  // Wordmark
  ctx.textAlign = "left";
  ctx.font = '700 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = INK.white;
  ctx.fillText("PRIVATUM", M, 96);

  ctx.textAlign = "right";
  ctx.font = '400 24px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = INK.dim;
  ctx.fillText("Robinhood Chain", W - M, 96);

  // Confirmed pill
  const pillW = 232;
  const pillX = (W - pillW) / 2;
  ctx.fillStyle = "rgba(16,185,129,0.12)";
  roundRect(ctx, pillX, 168, pillW, 56, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(16,185,129,0.28)";
  ctx.lineWidth = 2;
  roundRect(ctx, pillX, 168, pillW, 56, 28);
  ctx.stroke();

  // Check glyph
  ctx.strokeStyle = INK.success;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pillX + 34, 196);
  ctx.lineTo(pillX + 46, 208);
  ctx.lineTo(pillX + 68, 184);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = '600 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = INK.success;
  ctx.fillText("Transfer Signed", pillX + 86, 205);

  // Amount
  ctx.textAlign = "center";
  ctx.font = '700 108px "Cascadia Mono", Consolas, monospace';
  ctx.fillStyle = INK.white;
  ctx.fillText(`-${receipt.amount} ${receipt.asset}`, W / 2, 340);

  ctx.font = '400 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = INK.slate;
  ctx.fillText(
    receipt.recipientLabel || midTruncate(receipt.recipient, 14, 12),
    W / 2,
    396
  );

  // Detail panel
  const panelY = 460;
  const panelH = 430;
  ctx.fillStyle = INK.panel;
  roundRect(ctx, M, panelY, innerW, panelH, 28);
  ctx.fill();
  ctx.strokeStyle = INK.border;
  ctx.lineWidth = 2;
  roundRect(ctx, M, panelY, innerW, panelH, 28);
  ctx.stroke();

  const px = M + 44;
  const pw = innerW - 88;
  let y = panelY + 74;

  y = row(ctx, "Transaction", midTruncate(receipt.hash, 12, 10), px, y, pw, { mono: true });
  dashedLine(ctx, px, y - 40, px + pw);
  y = row(ctx, "Timestamp", formatStamp(receipt.timestamp), px, y, pw);
  dashedLine(ctx, px, y - 40, px + pw);
  y = row(
    ctx,
    "Network Fee",
    receipt.gasless
      ? "Sponsored"
      : receipt.feeEth
        ? `~${receipt.feeEth} ETH`
        : "Paid in ETH",
    px,
    y,
    pw,
    { color: receipt.gasless ? INK.success : INK.white }
  );
  dashedLine(ctx, px, y - 40, px + pw);
  y = row(ctx, "Privacy", receipt.stealth ? "Stealth (ERC-5564)" : "Standard Transfer", px, y, pw);
  dashedLine(ctx, px, y - 40, px + pw);
  y = row(ctx, "Security", "2-of-3 Threshold Quorum", px, y, pw);

  // QR + explorer link
  const qrSize = 220;
  const qrY = 960;
  try {
    const qrData = await QRCode.toDataURL(explorerUrl, {
      margin: 1,
      width: qrSize,
      color: { dark: "#0b0d12", light: "#ffffff" },
    });
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("QR image failed to load"));
      img.src = qrData;
    });
    ctx.fillStyle = INK.white;
    roundRect(ctx, M, qrY, qrSize, qrSize, 20);
    ctx.fill();
    ctx.drawImage(img, M, qrY, qrSize, qrSize);
  } catch {
    // QR is decorative — the link text below still carries the destination
  }

  ctx.textAlign = "left";
  ctx.font = '600 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = INK.white;
  ctx.fillText("Verify on explorer", M + qrSize + 40, qrY + 86);

  ctx.font = '400 21px "Cascadia Mono", Consolas, monospace';
  ctx.fillStyle = INK.dim;
  ctx.fillText(midTruncate(explorerUrl, 30, 14), M + qrSize + 40, qrY + 130);

  ctx.font = '400 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = INK.slate;
  ctx.fillText("Scan to open the transaction", M + qrSize + 40, qrY + 176);

  // Footer
  ctx.textAlign = "center";
  ctx.font = '400 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = INK.dim;
  ctx.fillText(
    "Self-custody 2-of-3 threshold account - privatumrh.com",
    W / 2,
    H - 56
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode receipt image."));
    }, "image/png");
  });
}

/** Plain-text summary used for the "copy receipt" action. */
export function buildReceiptText(receipt: TransactionReceipt, explorerUrl: string): string {
  return [
    `PRIVATUM - Transfer Signed`,
    `${receipt.amount} ${receipt.asset} to ${receipt.recipient}`,
    `Tx: ${receipt.hash}`,
    `Time: ${new Date(receipt.timestamp).toISOString()}`,
    `Network fee: ${receipt.gasless ? "Sponsored" : receipt.feeEth ? `~${receipt.feeEth} ETH` : "Paid in ETH"}`,
    explorerUrl,
  ].join("\n");
}
