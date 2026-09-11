/**
 * English -> Simplified Chinese copy map for the Privatum landing page.
 *
 * Keys are the rendered text with whitespace collapsed (see `normalizeKey` in
 * `./translate.ts`). Anything missing from this map is left in English, so the
 * map can be extended incrementally without breaking the page.
 */
export const ZH_DICTIONARY: Record<string, string> = {
  /* ---------- Navigation ---------- */
  Try: "体验",
  "Why choose Privatum for private self-custody?": "为什么选择 Privatum 进行隐私自托管？",
  "Main Pages": "主要页面",
  Product: "产品",
  Pages: "页面",
  Features: "功能",
  Download: "下载",
  Overview: "概览",
  Pipeline: "签名流程",
  "Signing Pipeline": "签名流程",
  Security: "安全",
  Roadmap: "路线图",
  "Case Studies": "案例研究",
  "Case Study": "案例研究",
  Docs: "文档",
  "SDK Docs": "SDK 文档",
  "SDK on npm": "npm 上的 SDK",
  "SDK on npm →": "npm 上的 SDK →",
  "npm SDK →": "npm SDK →",
  "npm →": "npm →",
  "GitHub →": "GitHub →",
  "GitHub Repository": "GitHub 代码库",
  "npm SDK Package": "npm SDK 包",
  "View repository on GitHub": "在 GitHub 上查看代码库",
  "View repository on GitHub →": "在 GitHub 上查看代码库 →",
  Research: "研究",
  "Private Send": "隐私转账",
  "Stealth Receive": "隐身收款",
  Swaps: "兑换",
  Swap: "兑换",
  Send: "发送",
  Receive: "接收",
  "Open SDK": "开放 SDK",
  "Download App": "下载应用",
  "Desktop Application": "桌面应用",
  "Social Media": "社交媒体",
  "Email Address": "电子邮箱",
  "Toggle mobile menu": "切换移动端菜单",

  /* ---------- Bridge rebates ---------- */
  "Bridge Rebates": "跨链返利",
  Rebates: "返利",
  "Bridge across four chains and earn the spread back": "跨四条链桥接，赚回中继价差",
  "Ethereum": "以太坊",
  "Base": "Base",
  "Arbitrum": "Arbitrum",
  "Worked example": "计算示例",
  "25% of spread": "价差的 25%",
  "Route": "路由",
  "Bridged": "桥接金额",
  "Relayer fee": "中继费用",
  "— destination gas": "— 目标链 Gas",
  "— relayer spread": "— 中继价差",
  "Your rebate": "您的返利",
  "$0.0174 in PRIV": "价值 $0.0174 的 PRIV",
  "Base → Robinhood Chain": "Base → Robinhood Chain",
  "Bridge through Privatum": "通过 Privatum 桥接",
  "Move ETH or USDG between Ethereum, Base, Arbitrum and Robinhood Chain. Routing and quotes come from Relay.":
    "在以太坊、Base、Arbitrum 与 Robinhood Chain 之间转移 ETH 或 USDG。路由与报价均来自 Relay。",
  "The spread is measured, not estimated": "价差为实测值，而非估算值",
  "Every quote separates destination gas from the relayer's margin. Only that margin - the spread - is rebated.":
    "每笔报价都会将目标链 Gas 与中继方的利润分开列示。仅对该利润（即价差）进行返利。",
  "Claim in PRIV on Robinhood Chain": "在 Robinhood Chain 上领取 PRIV",
  "Rebates accrue once a bridge settles and are claimable in PRIV, with the amount fixed at the price on claim.":
    "桥接结算后返利即开始累积，可按领取时的价格折算为 PRIV 领取。",
  "Figures from a live Relay quote. Rebates accrue per bridge and are claimable in PRIV on Robinhood Chain once the bridge settles.":
    "数据取自 Relay 实时报价。返利按每笔桥接累积，桥接结算后即可在 Robinhood Chain 上以 PRIV 领取。",
  "PrivatumRH • 18 decimals • Robinhood Chain": "PrivatumRH • 18 位小数 • Robinhood Chain",

  /* ---------- Hero ---------- */
  "Private payments. Non-custodial. On Robinhood Chain.": "隐私支付。非托管。基于 Robinhood Chain。",
  "Private payments. Non-custodial.": "隐私支付。非托管。",
  "Read Docs": "阅读文档",
  "Direct downloads:": "直接下载：",
  "All formats ↓": "全部版本 ↓",
  "CA:": "合约地址：",
  "Coming Soon": "即将推出",
  "Coming soon": "即将推出",
  Copy: "复制",
  Copied: "已复制",
  "Copy contract address": "复制合约地址",
  "Copied to clipboard!": "已复制到剪贴板！",
  "Contract Live": "合约已上线",
  "Token Coming Soon": "代币即将推出",
  "Open in Dexscreener": "在 Dexscreener 中打开",
  "Dexscreener (Token Coming Soon)": "Dexscreener（代币即将推出）",

  /* ---------- Comparison / overview ---------- */
  "2-of-3 Threshold Custody": "2/3 门限托管",
  "Hold, send, and swap frontier assets (USDG & native ETH) privately with a signing key split into three independent shards (2-of-3 quorum).":
    "以拆分为三份独立密钥分片（2/3 法定人数）的签名密钥，私密地持有、发送并兑换前沿资产（USDG 与原生 ETH）。",
  Network: "网络",
  "Robinhood Chain (Chain ID: 4663)": "Robinhood Chain（链 ID：4663）",
  "A 2-of-3 smart wallet architecture engineered for Robinhood Chain: frontier asset settlement (USDG & native ETH), automated policy co-signing, and passkey recovery.":
    "专为 Robinhood Chain 打造的 2/3 智能钱包架构：前沿资产结算（USDG 与原生 ETH）、自动化策略联签，以及通行密钥恢复。",
  "Browser wallet": "浏览器钱包",
  "Signing key": "签名密钥",
  "Stored on this device": "存储在本设备上",
  Exposed: "已暴露",
  "Single point of failure": "单点故障",
  "One key can authorize funds": "单个密钥即可动用资金",
  "Single-Key Hot Wallet": "单密钥热钱包",
  "Stores the complete private key in one browser or device, so one compromise can authorize every transaction.":
    "将完整私钥保存在单一浏览器或设备中，一次泄露即可授权所有交易。",
  "Offline signer": "离线签名器",
  Confirm: "确认",
  "Connect device": "连接设备",
  "Verify address": "验证地址",
  "Sign manually": "手动签名",
  Firmware: "固件",
  Shipping: "物流配送",
  "Seed phrase": "助记词",
  "Hardware Wallet": "硬件钱包",
  "Improves offline key isolation but adds hardware cost, firmware trust, shipping friction, and seed backup burden.":
    "提升了离线密钥隔离性，但带来硬件成本、固件信任、物流摩擦与助记词备份负担。",
  "Threshold quorum": "门限法定人数",
  "2 of 3 ready": "3 份中已就绪 2 份",
  Desktop: "桌面端",
  Signed: "已签名",
  "Co-signer": "联签方",
  "Co-Signer": "联签方",
  "Policy passed": "策略校验通过",
  Passkey: "通行密钥",
  Recovery: "恢复",
  "Quorum reached": "已达到法定人数",
  "Key never assembled": "密钥从不完整组装",
  "2-of-3 Threshold Quorum": "2/3 门限法定人数",
  "Splits signing authority mathematically across client Shard A (OS Keystore), Shard B (Co-signer policy engine), and Shard C (Hardware passkey). No single party can move funds.":
    "以数学方式将签名权限拆分至客户端分片 A（系统密钥库）、分片 B（联签策略引擎）与分片 C（硬件通行密钥）。任何单一方都无法动用资金。",

  /* ---------- Signing pipeline ---------- */
  Architecture: "架构",
  "The 5-Step Signing Pipeline": "五步签名流程",
  "Zero single points of failure. Every transaction requires off-chain ECDSA shard aggregation from two independent parties before executing on Robinhood Chain.":
    "零单点故障。每笔交易在 Robinhood Chain 上执行前，都需要两个独立方完成链下 ECDSA 分片聚合。",
  Build: "构建",
  "Desktop or SDK": "桌面端或 SDK",
  "Prepares an unsigned ERC-4337 UserOperation for USDG stablecoin or native ETH transfer.":
    "为 USDG 稳定币或原生 ETH 转账准备一笔未签名的 ERC-4337 UserOperation。",
  "unsigned userOpHash": "未签名的 userOpHash",
  "Client Sign": "客户端签名",
  "Local OS Keystore (Shard A)": "本地系统密钥库（分片 A）",
  "Client decrypts Shard A via device credentials (Keychain, DPAPI) and signs the userOpHash.":
    "客户端通过设备凭据（Keychain、DPAPI）解密分片 A，并对 userOpHash 签名。",
  "sigA (65 bytes)": "sigA（65 字节）",
  "Co-Sign": "联合签名",
  "Co-Signer API (Shard B)": "联签方 API（分片 B）",
  "Payload dispatched over TLS. Engine evaluates daily spend limits and velocity rules, then signs with Shard B.":
    "载荷通过 TLS 发送。引擎评估每日支出限额与频率规则，随后使用分片 B 签名。",
  "sigB (65 bytes)": "sigB（65 字节）",
  Combine: "聚合",
  "Aggregation Engine": "聚合引擎",
  "The two 65-byte signatures merge into an aggregate 130-byte threshold payload without assembling the root key.":
    "两个 65 字节签名合并为 130 字节的门限聚合载荷，全程不组装根密钥。",
  Settle: "结算",
  "Dispatched to Robinhood Chain bundler. PrivatumAccount contract validates 2-of-3 quorum and executes.":
    "发送至 Robinhood Chain 打包器。PrivatumAccount 合约校验 2/3 法定人数后执行。",
  "EntryPoint (Chain 4663)": "EntryPoint（链 4663）",
  "Emergency Recovery Quorum (Shard C + Shard B):": "紧急恢复法定人数（分片 C + 分片 B）：",
  "If your client device is lost or compromised, Shard C (Hardware Passkey / WebAuthn) combines with Shard B (Co-signer) to initiate emergency key rotation or fund migration without exposing a seed phrase.":
    "若客户端设备丢失或被攻破，分片 C（硬件通行密钥 / WebAuthn）可与分片 B（联签方）组合，在不暴露助记词的前提下发起紧急密钥轮换或资金迁移。",

  /* ---------- Protocol specs ---------- */
  "Protocol Specs": "协议规格",
  "Robinhood Chain Specifications & Endpoints": "Robinhood Chain 规格与接口",
  "Execution Network": "执行网络",
  "Robinhood Chain Mainnet": "Robinhood Chain 主网",
  "Network Stack": "网络栈",
  "Arbitrum Dedicated L2": "Arbitrum 专属 L2",
  "Chain ID": "链 ID",
  "Chain ID: 4663": "链 ID：4663",
  "Native Gas Token": "原生 Gas 代币",
  "Frontier Settlement Assets": "前沿结算资产",
  "USDG & Native ETH": "USDG 与原生 ETH",
  "Account Abstraction": "账户抽象",
  "Co-Signer Engine API Endpoints": "联签引擎 API 接口",
  Method: "方法",
  Endpoint: "接口",
  Description: "说明",
  "Payload / Notes": "载荷 / 备注",
  "Service health, version, and Robinhood Chain ID check": "服务健康状态、版本与 Robinhood 链 ID 校验",
  "Registers a new 2-of-3 threshold smart account": "注册新的 2/3 门限智能账户",
  "Submits UserOp for policy validation and Shard B co-signing": "提交 UserOp 进行策略校验与分片 B 联签",

  /* ---------- Highlights ---------- */
  Highlights: "亮点",
  "Private frontier asset payments built for Robinhood Chain": "为 Robinhood Chain 打造的前沿资产隐私支付",
  "Privatum delivers non-custodial USDG and native ETH settlement with 2-of-3 threshold security, automated policy co-signing, and passkey recovery.":
    "Privatum 提供非托管的 USDG 与原生 ETH 结算，具备 2/3 门限安全、自动化策略联签与通行密钥恢复。",
  "Transfer USDG or native ETH to any .privatum handle or Robinhood Chain address through a threshold-signed flow.":
    "通过门限签名流程，向任意 .privatum 账号或 Robinhood Chain 地址转账 USDG 或原生 ETH。",
  "Share a public .privatum meta-address while incoming payments arrive at dynamic ERC-5564 stealth destinations for unlinkability.":
    "共享公开的 .privatum 元地址，收款则抵达动态的 ERC-5564 隐身地址，实现不可关联性。",

  /* ---------- Downloads ---------- */
  "Download Privatum Desktop": "下载 Privatum 桌面端",
  "Threshold custody, frontier asset settlement (USDG & native ETH), stealth addresses, and atomic swaps natively on your desktop. Built with Tauri v2 and Rust, connected directly to Robinhood Chain.":
    "在桌面端原生使用门限托管、前沿资产结算（USDG 与原生 ETH）、隐身地址与原子兑换。基于 Tauri v2 与 Rust 构建，直连 Robinhood Chain。",
  "Detected OS": "检测到的系统",
  "64-bit (x64)": "64 位 (x64)",
  "Apple Silicon (arm64)": "Apple 芯片 (arm64)",
  Platform: "平台",
  "macOS 11.0+": "macOS 11.0 及以上",
  Package: "安装包",
  Packages: "安装包",
  "Setup (.exe)": "安装程序 (.exe)",
  "App Bundle (.tar.gz / .dmg)": "应用包 (.tar.gz / .dmg)",
  "Target File": "目标文件",
  "Download for Windows (.exe)": "下载 Windows 版 (.exe)",
  "Download for macOS": "下载 macOS 版",
  "Download for Linux": "下载 Linux 版",
  "Download for Windows": "下载 Windows 版",
  "Double-click the installer to launch Privatum setup.": "双击安装程序即可启动 Privatum 安装向导。",
  "Extract archive and move Privatum.app to Applications.": "解压归档并将 Privatum.app 移动到「应用程序」文件夹。",
  "Debian/Ubuntu:": "Debian/Ubuntu：",
  "• Arch/Fedora: run AppImage or native binary": "• Arch/Fedora：运行 AppImage 或原生二进制文件",
  "Automated releases built and signed for Windows, macOS, and Linux.": "面向 Windows、macOS 与 Linux 自动构建并签名的发行版。",
  "Robinhood Chain Mainnet • Chain ID:": "Robinhood Chain 主网 • 链 ID：",
  "• Arbitrum L2 • Native Gas:": "• Arbitrum L2 • 原生 Gas：",

  /* ---------- Product showcase ---------- */
  "Build and launch private payment flows with confidence": "放心构建并上线隐私支付流程",
  "Create threshold-secured payment workflows for users, teams, and developers using a native desktop app and open SDK.":
    "借助原生桌面应用与开放 SDK，为用户、团队与开发者构建门限安全的支付工作流。",
  "Private transfer": "隐私转账",
  Protected: "已保护",
  Verified: "已验证",
  "Review private send": "审核隐私转账",
  "Stealth address created": "隐身地址已创建",
  "Private send and stealth receive": "隐私转账与隐身收款",
  "Send USDG and native ETH to handles or raw addresses, then receive payments through one-time stealth destinations.":
    "向账号或原始地址发送 USDG 与原生 ETH，并通过一次性隐身地址接收款项。",
  "Swap route": "兑换路由",
  "Best price": "最优价格",
  Slippage: "滑点",
  "In-wallet USDG & ETH swaps": "钱包内 USDG 与 ETH 兑换",
  "Route USDG and native ETH swaps through Robinhood Chain liquidity with clear quote and slippage controls.":
    "通过 Robinhood Chain 流动性路由 USDG 与原生 ETH 兑换，提供清晰的报价与滑点控制。",
  "Signing session": "签名会话",
  Live: "实时",
  "Transfer intent": "转账意图",
  "Partial signed (65B)": "部分签名（65 字节）",
  "Policy approved (65B)": "策略已批准（65 字节）",
  "Standby (Recovery)": "待命（恢复）",
  "2-of-3 threshold signing": "2/3 门限签名",
  "The desktop client signs locally with Shard A, the co-signer validates policy and signs with Shard B, and signatures merge into an aggregate 130-byte threshold payload.":
    "桌面客户端使用分片 A 在本地签名，联签方校验策略并使用分片 B 签名，两个签名合并为 130 字节的门限聚合载荷。",
  "Command center": "指挥中心",
  "All systems ready": "所有系统就绪",
  "Shielded portfolio (USDG & ETH)": "屏蔽资产组合（USDG 与 ETH）",
  "Shielded portfolio": "屏蔽资产组合",
  Quorum: "法定人数",
  "2 of 3": "3 份中的 2 份",
  Policy: "策略",
  Armed: "已启用",
  "Stealth receive": "隐身收款",
  "Native desktop command center": "原生桌面指挥中心",
  "Manage USDG and native ETH balances, shard health, recovery passkeys, spending policy controls, swaps, and private payment activity from one desktop surface.":
    "在同一桌面界面中管理 USDG 与原生 ETH 余额、分片健康状况、恢复通行密钥、支出策略控制、兑换及隐私支付记录。",

  /* ---------- Reliability ---------- */
  "Reliable custody that continuously verifies itself": "持续自我校验的可靠托管",
  "Continuously monitor shard readiness, policy checks, activity, and recovery paths before funds move.":
    "在资金转移前，持续监控分片就绪状态、策略校验、活动记录与恢复路径。",
  "Shard health monitoring": "分片健康监控",
  "Check client, co-signer, and passkey readiness before a transaction reaches the signing pipeline.":
    "在交易进入签名流程前，检查客户端、联签方与通行密钥的就绪状态。",
  "Co-signer policy enforcement": "联签策略执行",
  "Validate session, transaction intent, spending limits, velocity, and anomaly signals before the second signature.":
    "在第二次签名前，校验会话、交易意图、支出限额、频率与异常信号。",
  "Activity and recovery visibility": "活动与恢复可视化",
  "Track settlement history, export activity, rehearse recovery, and rotate a lost client shard without a seed phrase.":
    "追踪结算历史、导出活动记录、演练恢复流程，并在无需助记词的情况下轮换丢失的客户端分片。",
  "Custody posture": "托管态势",
  "Continuous verification": "持续验证",
  "shards online": "个分片在线",
  "Current quorum": "当前法定人数",
  "No single shard can sign alone": "任何单个分片都无法独立签名",
  "Desktop shard": "桌面端分片",
  Ready: "就绪",
  "Policy co-signer": "策略联签方",
  "Limits + intent verified": "限额与意图已校验",
  "Recovery passkey": "恢复通行密钥",
  Session: "会话",
  Intent: "意图",
  Velocity: "频率",
  Sign: "签名",

  /* ---------- Demo ---------- */
  "Try our live demo": "试用在线演示",
  "Discover the full potential of Privatum Live": "探索 Privatum Live 的全部潜力",
  "See how threshold custody coordinates private send, stealth receive, swaps, policy checks, and recovery in one operational flow.":
    "了解门限托管如何在同一操作流程中协调隐私转账、隐身收款、兑换、策略校验与恢复。",
  Module: "模块",
  "Wallet Handle": "钱包账号",
  "Passkey Session": "通行密钥会话",
  "Private Send & Swaps": "隐私转账与兑换",

  /* ---------- Case studies ---------- */
  "Research driving the Privatum product thesis": "支撑 Privatum 产品论点的研究",
  "What wallet drainers, custodial collapse, hardware recovery, and privacy infrastructure reveal about modern custody.":
    "钱包盗刷、托管方崩塌、硬件恢复与隐私基础设施，揭示了现代托管的真实面貌。",
  "Wallet drainers show why one valid signature should never control an entire balance.":
    "钱包盗刷说明：一次有效签名绝不应控制全部余额。",
  "Read Case Study": "阅读案例研究",
  "$494M wallet drainer losses": "4.94 亿美元钱包盗刷损失",
  "FTX shows how custodial convenience becomes counterparty risk when users cannot verify control.":
    "FTX 表明：当用户无法验证控制权时，托管的便利便演变为交易对手风险。",
  "$9B custodial liabilities": "90 亿美元托管负债",
  "Hardware recovery debates show why seed phrases remain a fragile default for mainstream users.":
    "关于硬件恢复的争论说明：助记词对主流用户而言仍是脆弱的默认方案。",
  "3-party recovery debate": "三方恢复之争",

  /* ---------- Integrations ---------- */
  Integrations: "集成",
  "Connect every payment touchpoint effortlessly": "轻松连接每一个支付触点",
  "Transfer stablecoins through a two-shard signing flow with policy checks.": "通过带策略校验的双分片签名流程转账稳定币。",
  "Share one handle while incoming payments arrive at one-time addresses.": "共享一个账号，收款则抵达一次性地址。",
  "In-Wallet Swaps": "钱包内兑换",
  "Swap supported stablecoins with route, quote, and slippage visibility.": "在可见的路由、报价与滑点下兑换受支持的稳定币。",
  "Embed threshold wallets into applications with a Viem based TypeScript SDK.":
    "使用基于 Viem 的 TypeScript SDK 将门限钱包嵌入应用。",

  /* ---------- Compliance ---------- */
  "Compliance & Security": "合规与安全",
  "Enterprise security for every private payment": "为每笔隐私支付提供企业级安全",
  "Data Protection": "数据保护",
  "Protect local shards with encrypted storage, OS keychains, isolated environments, and strict session controls.":
    "通过加密存储、系统钥匙串、隔离环境与严格的会话控制保护本地分片。",
  "Policy Controls": "策略控制",
  "Enforce daily limits, velocity checks, anomaly detection, and transaction intent validation before co-signing.":
    "在联签前执行每日限额、频率校验、异常检测与交易意图验证。",
  "High Availability": "高可用性",
  "Maintain co-signer availability with monitored infrastructure, failover planning, and operational alerts.":
    "通过受监控的基础设施、故障转移预案与运维告警保障联签方可用性。",
  "Secure Access Control": "安全访问控制",
  "Use passkeys, session checks, and quorum rules to manage access without giving any one party custody.":
    "使用通行密钥、会话校验与法定人数规则管理访问权限，且不将托管权交给任何一方。",

  /* ---------- Connected ---------- */
  Connected: "互联",
  "Reach users across every payment surface": "触达每一个支付场景中的用户",
  "Privatum connects desktop, Viem SDK, Robinhood Chain, USDG & ETH swaps, stealth receive, and recovery surfaces in one 2-of-3 custody model.":
    "Privatum 在同一 2/3 托管模型中连接桌面端、Viem SDK、Robinhood Chain、USDG 与 ETH 兑换、隐身收款及恢复能力。",
  "Desktop command center": "桌面指挥中心",
  "Live on npm →": "已在 npm 上线 →",
  "Threshold signature aggregated": "门限签名已聚合",
  "130-byte payload submitted to Robinhood Chain": "130 字节载荷已提交至 Robinhood Chain",
  "Frontier Stablecoin Rail": "前沿稳定币通道",
  "USDG ready": "USDG 就绪",
  "Frontier send": "前沿资产转账",
  "Robinhood Chain EntryPoint settled": "Robinhood Chain EntryPoint 已结算",
  "Native Gas & Settlement": "原生 Gas 与结算",
  "ETH active": "ETH 已启用",
  "Native settlement": "原生结算",
  "Arbitrum L2 gas & transfers": "Arbitrum L2 的 Gas 与转账",
  "Instant L2 settlement • Chain ID 4663": "L2 即时结算 • 链 ID 4663",
  "Native ETH settlement and gas liquidity": "原生 ETH 结算与 Gas 流动性",

  /* ---------- Roadmap ---------- */
  "Roadmap to native privacy.": "通往原生隐私的路线图。",
  "Phase 1": "第 1 阶段",
  "Phase 2": "第 2 阶段",
  "Phase 3": "第 3 阶段",
  "Phase 4": "第 4 阶段",
  "Phase 5": "第 5 阶段",
  "Phase 6": "第 6 阶段",
  shipped: "已交付",
  "in progress": "进行中",
  next: "下一步",
  planned: "已规划",
  "Robinhood Chain Custody MVP": "Robinhood Chain 托管 MVP",
  "ERC-4337 smart accounts, 2-of-3 threshold sharding and passkey recovery, live on Robinhood Chain mainnet with a Tauri v2 desktop client.":
    "ERC-4337 智能账户、2/3 门限分片与通行密钥恢复，已随 Tauri v2 桌面客户端在 Robinhood Chain 主网上线。",
  "ERC-4337 accounts": "ERC-4337 账户",
  "Threshold sharding": "门限分片",
  "Passkey recovery": "通行密钥恢复",
  "Desktop client": "桌面客户端",
  "Open SDK & Developer Ecosystem": "开放 SDK 与开发者生态",
  "A public, typed TypeScript toolkit built on Viem (@privatumrh/robinhood-chain-sdk), with guides, sample apps and audit-ready threshold primitives under MIT licensing.":
    "基于 Viem 构建的公开类型化 TypeScript 工具包（@privatumrh/robinhood-chain-sdk），在 MIT 许可下提供指南、示例应用与可审计的门限原语。",
  "Viem APIs": "Viem API",
  "Developer guides": "开发者指南",
  "MIT licensed": "MIT 许可",
  "DEX Aggregation & USDG/ETH Swaps": "DEX 聚合与 USDG/ETH 兑换",
  "Low-slippage USDG and native ETH routing with transparent quotes, slippage controls and policy-checked execution across desktop and SDK.":
    "在桌面端与 SDK 上提供低滑点的 USDG 与原生 ETH 路由，具备透明报价、滑点控制与经策略校验的执行。",
  "USDG / ETH swaps": "USDG / ETH 兑换",
  "Aggregated routes": "聚合路由",
  "Quote previews": "报价预览",
  "Slippage controls": "滑点控制",
  "Privacy Plane One": "隐私层一",
  "Threshold ECDSA and blind co-signing with ZK policy proofs, so signatures look standard and policy runs without profiling.":
    "门限 ECDSA 与带 ZK 策略证明的盲联签，使签名看起来与常规无异，策略执行也无需画像。",
  "Threshold ECDSA": "门限 ECDSA",
  "Blind co-signing": "盲联签",
  "ZK policy proofs": "ZK 策略证明",
  "Invisible setup": "无感配置",
  "Privacy Plane Two": "隐私层二",
  "ERC-5564 stealth addresses, receiver unlinkability and screened privacy pools with association-set proofs for compliance-aware privacy.":
    "ERC-5564 隐身地址、收款方不可关联性，以及带关联集证明的筛查隐私池，实现合规友好的隐私。",
  "Stealth addresses": "隐身地址",
  Unlinkability: "不可关联性",
  "Privacy pools": "隐私池",
  "Provenance checks": "来源校验",
  "Multichain expansion": "多链扩展",
  "Additional EVM adapters and new L2 networks with one shard model, a portable co-signer and a consistent desktop experience everywhere.":
    "更多 EVM 适配器与新的 L2 网络，采用统一的分片模型、可移植的联签方，以及处处一致的桌面体验。",
  "EVM adapters": "EVM 适配器",
  "New L2s": "新增 L2",
  "Portable co-signer": "可移植联签方",
  "Unified recovery": "统一恢复",

  /* ---------- FAQ ---------- */
  FAQ: "常见问题",
  "Common Questions": "常见问题解答",
  "What does Privatum do?": "Privatum 是做什么的？",
  "Privatum is a self-custodial smart wallet and open developer toolkit engineered for Robinhood Chain (Arbitrum-powered EVM L2, Chain ID 4663). It enables individuals and automated workflows to hold, send, and swap frontier assets (specifically USDG and native ETH) with zero single points of failure.":
    "Privatum 是专为 Robinhood Chain（由 Arbitrum 驱动的 EVM L2，链 ID 4663）打造的自托管智能钱包与开放开发者工具包。它让个人与自动化工作流能够在零单点故障的前提下持有、发送并兑换前沿资产（具体为 USDG 与原生 ETH）。",
  "How does 2-of-3 threshold custody work?": "2/3 门限托管是如何工作的？",
  "Your private key is mathematically split into three independent shards: Shard A on your local device (stored encrypted in OS keystores), Shard B with the automated co-signer policy service, and Shard C in hardware passkey recovery. Any two shards can authorize transactions or recover access. No single party, not even Privatum, can ever move your funds.":
    "您的私钥以数学方式拆分为三份独立分片：分片 A 位于本地设备（加密存储于系统密钥库）、分片 B 由自动化联签策略服务持有、分片 C 用于硬件通行密钥恢复。任意两份分片即可授权交易或恢复访问权限。任何单一方，包括 Privatum 自身，都无法动用您的资金。",
  "How does the 5-step signing pipeline work?": "五步签名流程是如何运作的？",
  "1) Build: Desktop or SDK creates an unsigned ERC-4337 UserOperation for USDG or ETH transfer. 2) Client Sign: Local device decrypts Shard A via device credentials and signs the userOpHash. 3) Co-Sign: Dispatched over TLS to the Co-Signer API, which evaluates velocity and daily limits before signing with Shard B. 4) Combine: Two 65-byte signatures merge into an aggregate 130-byte threshold signature (sigA || sigB). 5) Settle: Broadcast to the Robinhood Chain bundler and validated by the PrivatumAccount smart contract onchain.":
    "1）构建：桌面端或 SDK 为 USDG 或 ETH 转账创建未签名的 ERC-4337 UserOperation。2）客户端签名：本地设备通过设备凭据解密分片 A 并对 userOpHash 签名。3）联签：通过 TLS 发送至联签方 API，由其评估频率与每日限额后使用分片 B 签名。4）聚合：两个 65 字节签名合并为 130 字节的门限聚合签名（sigA || sigB）。5）结算：广播至 Robinhood Chain 打包器，并由 PrivatumAccount 智能合约在链上完成校验。",
  "What happens if I lose my computer?": "如果我的电脑丢失了怎么办？",
  "If your client device is lost, Shard C (Passkey Recovery) combines with Shard B (Co-signer) to initiate emergency key rotation or fund migration without exposing a seed phrase.":
    "若客户端设备丢失，分片 C（通行密钥恢复）可与分片 B（联签方）组合，在不暴露助记词的前提下发起紧急密钥轮换或资金迁移。",
  "Does Privatum have custody of funds?": "Privatum 会托管资金吗？",
  "No. Privatum operates only the automated co-signer shard (Shard B). Because every transaction strictly requires 2-of-3 quorum signatures, Privatum cannot unilaterally move any assets.":
    "不会。Privatum 仅运行自动化联签分片（分片 B）。由于每笔交易都严格要求 2/3 法定人数签名，Privatum 无法单方面转移任何资产。",
  "Which network and assets does Privatum support?": "Privatum 支持哪些网络与资产？",
  "Privatum is built natively for Robinhood Chain (Arbitrum-powered EVM L2, Chain ID 4663, ETH gas token), natively settling and routing frontier assets: USDG stablecoin and native ETH.":
    "Privatum 原生构建于 Robinhood Chain（由 Arbitrum 驱动的 EVM L2，链 ID 4663，以 ETH 作为 Gas 代币），原生结算并路由前沿资产：USDG 稳定币与原生 ETH。",
  "What are the Co-Signer API endpoints?": "联签方 API 有哪些接口？",
  "The co-signer service exposes GET /health (service health and Chain ID 4663 check), POST /v1/wallets (registration of 2-of-3 threshold accounts), and POST /v1/cosign (policy verification and Shard B co-signing).":
    "联签服务提供 GET /health（服务健康状态与链 ID 4663 校验）、POST /v1/wallets（注册 2/3 门限账户）以及 POST /v1/cosign（策略校验与分片 B 联签）。",
  "When will native privacy launch?": "原生隐私功能何时上线？",
  "The roadmap moves from Phase 1 (Robinhood Chain Custody MVP) and Phase 2 (Open SDK) to Phase 3 (DEX Aggregation & USDG/ETH Swaps), Phase 4 (Privacy Plane One: Threshold ECDSA & Blind Co-signing), Phase 5 (Privacy Plane Two: ERC-5564 Stealth Addresses & Screened Pools), and Phase 6 (Multichain Expansion).":
    "路线图从第 1 阶段（Robinhood Chain 托管 MVP）与第 2 阶段（开放 SDK），推进到第 3 阶段（DEX 聚合与 USDG/ETH 兑换）、第 4 阶段（隐私层一：门限 ECDSA 与盲联签）、第 5 阶段（隐私层二：ERC-5564 隐身地址与筛查池），以及第 6 阶段（多链扩展）。",

  /* ---------- Stack chips ---------- */
  "Arbitrum L2 (Chain ID 4663)": "Arbitrum L2（链 ID 4663）",
  "Frontier settlement assets": "前沿结算资产",
  "2-of-3 Quorum": "2/3 法定人数",
  "ECDSA shard aggregation": "ECDSA 分片聚合",
  "Co-Signer Engine": "联签引擎",
  "Automated spend & velocity policies": "自动化支出与频率策略",
  "Smart accounts & UserOps": "智能账户与 UserOps",
  "Hardware recovery Shard C": "硬件恢复分片 C",
  "Viem Open SDK": "Viem 开放 SDK",
  "Tauri v2 Desktop": "Tauri v2 桌面端",
  "Encrypted OS keystores": "加密的系统密钥库",
  "ERC-5564 Stealth": "ERC-5564 隐身",
  "One-time destination addresses": "一次性目标地址",
  "Screened Pools": "筛查池",
  "Association-set ZK proofs": "关联集 ZK 证明",

  /* ---------- Platform data ---------- */
  "x64 installer": "x64 安装程序",
  ".exe setup": ".exe 安装包",
  "Windows 10, 11 (64-bit)": "Windows 10、11（64 位）",
  "Run PRIVATUM_0.1.0_x64-setup.exe to install Privatum on your system.":
    "运行 PRIVATUM_0.1.0_x64-setup.exe 即可在您的系统上安装 Privatum。",
  "Apple Silicon": "Apple 芯片",
  "macOS 11.0 Big Sur or later (Apple Silicon)": "macOS 11.0 Big Sur 或更高版本（Apple 芯片）",
  "Extract archive and drag Privatum into Applications.": "解压归档并将 Privatum 拖入「应用程序」文件夹。",
  "Debian & AppImage": "Debian 与 AppImage",
  "Ubuntu, Debian, Fedora, Arch Linux": "Ubuntu、Debian、Fedora、Arch Linux",
  "Install package using dpkg or execute AppImage directly.": "使用 dpkg 安装软件包，或直接运行 AppImage。",

  /* ---------- Footer ---------- */
  "Build private payments on Robinhood Chain": "在 Robinhood Chain 上构建隐私支付",
  "Read the developer docs, explore the architecture, and follow the roadmap to native privacy.":
    "阅读开发者文档、了解架构设计，并关注通往原生隐私的路线图。",
  "Private payments. Non-custodial. On Robinhood Chain. Hold, send, and swap frontier assets (USDG & native ETH) with 2-of-3 threshold security.":
    "隐私支付。非托管。基于 Robinhood Chain。以 2/3 门限安全持有、发送并兑换前沿资产（USDG 与原生 ETH）。",
  "© 2026 Privatum. All rights reserved.": "© 2026 Privatum. 保留所有权利。",
};
