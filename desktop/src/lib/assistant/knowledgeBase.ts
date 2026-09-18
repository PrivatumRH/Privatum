/**
 * Privatum Domain Knowledge Base
 *
 * Provides deterministic, zero-latency explanations for core wallet concepts:
 * - Stealth addresses (ERC-5564) and recipient privacy
 * - 2-of-2 MPC shard architecture and key protection
 * - Address poisoning defense and look-alike detection
 * - Spending guardrails and 24-hour rolling velocity limits
 * - Disposable pay links and single-use escrow
 * - Gasless execution, EIP-4337 account abstraction, and bundlers
 * - Non-custodial security model and zero telemetry guarantees
 */

export interface KnowledgeAnswer {
  matched: boolean;
  topic: string;
  summary: string;
  bulletPoints: string[];
  suggestedActions?: string[];
}

interface KnowledgeEntry {
  topic: string;
  patterns: RegExp[];
  summary: string;
  bulletPoints: string[];
  suggestedActions?: string[];
}

const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  {
    topic: "stealth_addresses",
    patterns: [
      /stealth/i,
      /recipient\s*privacy/i,
      /unlinkab(le|ility)/i,
      /hide\s*(my\s*)?(recipient|receiver|identity|address)/i,
      /private\s*(send|transfer|transaction)/i,
      /erc-?5564/i,
    ],
    summary:
      "Stealth addresses protect recipient privacy by generating a unique, one-time destination address for every incoming transfer.",
    bulletPoints: [
      "On-Chain Unlinkability: Public blockchain observers and block explorers see funds sent to an ephemeral, single-use address. It cannot be linked back to the recipient's public wallet or identity.",
      "Dual-Key Ephemeral Derivation (ERC-5564): The sender uses the recipient's stealth meta-address and an ephemeral secret to compute the stealth destination address mathematically.",
      "Non-Interactive Discovery: The recipient uses their private viewing key to scan the chain and discover funds without interacting with the sender or any central server.",
      "Zero Link Between Payments: Even if the same sender pays the same recipient ten times, each transfer settles at an entirely distinct address with zero on-chain connection between them.",
      "One-Click Activation: In Privatum, enable Private Send (Stealth) in the Send dialog or provide a stealth meta-address (st:eth:0x...).",
    ],
    suggestedActions: [
      "Send with Stealth: Open Send modal and toggle Private Send",
      "Copy Meta-Address: Find your stealth meta-address in Receive modal",
    ],
  },
  {
    topic: "mpc_shards",
    patterns: [
      /2-of-2|mpc|shard\s*[ab]?|co-signer|key\s*share/i,
      /how\s*(does\s*)?mpc\s*work/i,
      /how\s*are\s*keys\s*stored/i,
      /non-?custodial/i,
      /who\s*holds\s*my\s*key/i,
      /lost\s*(my\s*)?phone|recovery/i,
    ],
    summary:
      "Privatum utilizes a 2-of-2 Multi-Party Computation (MPC) architecture that splits your private signing capability into two isolated mathematical shards.",
    bulletPoints: [
      "Shard A (Client-Side): Stored strictly on your local device in encrypted hardware-backed storage. It never leaves your machine.",
      "Shard B (Remote Co-Signer): Managed by the isolated Privatum co-signer service, protected by your Multi-Factor Authentication (MFA).",
      "Threshold Signing: Neither shard alone can authorize a transaction. Every transfer requires mathematical cooperation between Shard A and Shard B.",
      "Non-Custodial Guarantee: The remote co-signer cannot steal your funds because it only possesses Shard B (half the equation). You maintain sovereign ownership.",
      "Emergency Protection: If your device is lost or compromised, you can trigger an Emergency Panic Freeze to lock Shard B instantly.",
    ],
    suggestedActions: [
      "Inspect Security Settings: View your MFA and co-signer status in Settings",
    ],
  },
  {
    topic: "address_poisoning",
    patterns: [
      /poison(ing)?|look-?alike|spoof(ing)?|fake\s*address/i,
      /address\s*guard/i,
      /vanity\s*scam/i,
      /clipboard\s*hijack/i,
    ],
    summary:
      "Address poisoning is an attack where scammers deploy dummy smart contracts that match the leading and trailing characters of your frequent counterparties, then send zero-value spam transfers into your history.",
    bulletPoints: [
      "The Scam: Attackers hope you will copy a recipient address from your recent transaction list without verifying the middle hex characters.",
      "Privatum Address Guard: Automatically scans all outgoing addresses against your historical ledger, flagging any candidate that shares identical prefix or suffix characters with another counterparty.",
      "Three-Tier Safety Verdict: Clean (verified or novel), Warning (counterparty variation), or Danger (unsolicited zero-value spoof detected).",
      "Contact Autocomplete Defense: Using your encrypted Address Book prevents copy-paste errors by populating verified addresses directly.",
    ],
    suggestedActions: [
      "Run Manual Check: Type 'Check address 0x...' to inspect any candidate",
      "Use Address Book: Save frequent counterparties to avoid copy-pasting",
    ],
  },
  {
    topic: "spending_guardrails",
    patterns: [
      /guardrail(s)?|spending\s*limit(s)?|velocity|daily\s*cap|budget/i,
      /strict\s*mode/i,
      /how\s*much\s*can\s*i\s*spend/i,
    ],
    summary:
      "Spending guardrails enforce velocity limits to protect your wallet against catastrophic drain attacks, accidental transfers, and unauthorized large expenditures.",
    bulletPoints: [
      "Rolling 24-Hour Velocity: Limits are calculated on a continuous rolling 24-hour window rather than resetting at midnight. Headroom returns gradually as older transfers pass the 24h mark.",
      "Single-Transaction Threshold: Sets an upper limit for any individual transfer, preventing mistaken single-click payouts.",
      "Enforcement Modes: Advisory mode prompts you with a confirmation warning before signing. Strict mode blocks transfers exceeding the threshold outright until budget frees up.",
      "Local Evaluation: Guardrail rules and spending histories are evaluated entirely inside client memory on your machine.",
    ],
    suggestedActions: [
      "Check Headroom: Type 'What is my spending limit?' in the assistant",
      "Adjust Limits: Configure daily caps in the Guardrails dialog",
    ],
  },
  {
    topic: "paylinks",
    patterns: [
      /pay\s*link(s)?|disposable\s*link|payment\s*link/i,
      /how\s*do\s*paylinks\s*work/i,
      /create\s*pay\s*link/i,
    ],
    summary:
      "Disposable pay links allow you to send funds via a one-time cryptographic URL that anyone can claim without sharing their wallet address beforehand.",
    bulletPoints: [
      "Smart Contract Escrow: Funds are deposited into a disposable escrow smart contract on Robinhood Chain.",
      "Single-Use Claim Key: The link contains an embedded claim secret in its URL hash fragment. The secret never touches any server.",
      "Revocability: If the recipient does not claim the link, or if you sent it to the wrong party, you can cancel the pay link and reclaim your funds anytime.",
      "Counterparty Privacy: The recipient can claim the funds into any address of their choosing, including a fresh stealth address.",
    ],
    suggestedActions: [
      "Create Pay Link: Type 'Create paylink for 25 USDG' in the assistant",
    ],
  },
  {
    topic: "gasless_account_abstraction",
    patterns: [
      /gas(less)?|fee(s)?|paymaster|bundler|eip-?4337|userop(eration)?/i,
      /how\s*do\s*i\s*pay\s*gas/i,
      /who\s*pays\s*gas/i,
    ],
    summary:
      "Privatum accounts are built on the ERC-4337 account abstraction standard, enabling gasless operations and seamless transaction bundling.",
    bulletPoints: [
      "Sponsored Transactions: Eligible transfers and contract interactions are sponsored by the Privatum Paymaster on Robinhood Chain.",
      "Zero Gas Token Friction: You do not need to hold native gas tokens (like ETH) in your account simply to send stablecoins (USDG).",
      "UserOperations: Transactions are packaged as UserOperations, signed by your 2-of-2 MPC shards, and submitted to the bundler for on-chain execution.",
    ],
  },
  {
    topic: "privacy_and_security",
    patterns: [
      /privacy|telemetry|track(ing)?|leak(s)?|secure|safety/i,
      /does\s*privatum\s*track\s*me/i,
      /where\s*is\s*my\s*data/i,
    ],
    summary:
      "Privatum enforces a zero-telemetry architecture. All private state, addresses, and cryptographic operations remain on your device.",
    bulletPoints: [
      "Zero Telemetry: No prompts, wallet addresses, contact names, or transaction amounts are transmitted to third-party analytics or cloud AI providers.",
      "Local AI & NLP: Natural language queries and financial calculations run deterministically or via an on-device SmolLM2 Web Worker directly inside your browser/desktop runtime.",
      "Hardware-Backed Shards: Shard A is protected locally, and prompt ingress is sanitized by the Ingress Redaction Gateway to prevent accidental secret leakage.",
    ],
  },
  {
    topic: "offline_outbox",
    patterns: [
      /offline\s*(signing|mode|outbox|txs?|transfers?)/i,
      /air-?gap(ped)?(\s*mode)?/i,
      /delayed\s*broadcast/i,
      /how\s*does\s*(the\s*)?(offline\s+outbox|air-?gap)\s*work/i,
      /queue(d)?\s*(transfers?|transactions?)/i,
    ],
    summary:
      "Privatum's Offline Outbox allows you to sign transfers securely in an air-gapped or disconnected environment and queue them for delayed onchain broadcast.",
    bulletPoints: [
      "Local Shard A Signing: Transfers are signed locally using your device Shard A without requiring RPC connectivity.",
      "Strict Sequential Nonces: The engine tracks confirmed base nonces and queues transfers sequentially to prevent nonce gaps or transaction collisions.",
      "Forced Air-Gap Mode: You can force all transfers to be staged in the outbox even while internet is connected, allowing batch review before relay.",
      "Delayed One-Click Relay: When you reconnect or exit Air-Gap mode, you can broadcast the entire batch or individual transfers with a single click.",
      "Automated Diagnostics: If a broadcast fails due to gas or nonce drift, Privatum detects the root cause and provides direct remediation.",
    ],
    suggestedActions: [
      "View Outbox: Type 'Open outbox' or 'What is in my outbox?'",
      "Broadcast Queue: Type 'Broadcast outbox' to settle all queued transfers",
    ],
  },
];

/**
 * Evaluates a user query against the domain knowledge base.
 * Returns an answer if the query matches a known conceptual topic.
 */
export function queryKnowledgeBase(query: string): KnowledgeAnswer | null {
  const clean = query.trim().toLowerCase();
  if (clean.length < 3) return null;

  for (const entry of KNOWLEDGE_ENTRIES) {
    for (const pattern of entry.patterns) {
      if (pattern.test(clean)) {
        return {
          matched: true,
          topic: entry.topic,
          summary: entry.summary,
          bulletPoints: entry.bulletPoints,
          suggestedActions: entry.suggestedActions,
        };
      }
    }
  }

  return null;
}
