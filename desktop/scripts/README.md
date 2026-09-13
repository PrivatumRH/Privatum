# Verifying a Privatum inference receipt

Every reply from the Privatum Assistant carries a receipt: SHA-256 digests of
the prompt, the response, and the pipeline that produced them. Expanding the
receipt in the app and choosing **Export Signed** writes a JSON bundle.

This tool checks that bundle without running, trusting, or contacting Privatum.

```sh
cd desktop
bun install
bun run verify:receipt path/to/privatum-inference-receipt-a1b2c3d4.json
```

Options: `--json` for a machine-readable report, `--strict` to also exit
non-zero when something cannot be proven (useful in CI).

Exit codes: `0` nothing failed, `1` a check failed, `2` bad usage.

## Three ways to verify, one implementation

| Where | How |
|---|---|
| In the app | Expand a receipt, click **Verify** |
| Command line | `bun run verify:receipt <bundle.json>` |
| Browser | Open `web-verifier/dist/verify.html`, drop the file on it |

All three call the same `verifyReceiptBundle` from
`src/lib/assistant/receiptExport.ts`, so they agree by construction rather than
by good intentions.

### Building the browser verifier

```sh
bun run build:verifier
```

Bundles the verification module into a single self-contained HTML file at
`web-verifier/dist/verify.html`. No CDN, no external requests, no build output
to host anywhere - open it from disk with the network switched off and it still
works. A verifier that fetches its crypto from a CDN is asking you to trust that
CDN, which defeats the point, so the build fails outright if a network primitive
turns up in the bundle.

## What a passing result means

The verifier recomputes, from the plaintext in the bundle:

- `sha256(transcript.input)` equals the receipt's `inputHash`
- `sha256(transcript.output)` equals the receipt's `outputHash`
- the bundle digest equals `sha256(domain tag || canonical payload)`
- the signature recovers to the wallet address the bundle names

Those are arithmetic facts you recompute yourself. Nothing is taken on trust.

Editing any part of the transcript breaks the digest, and a signature that was
made over the original payload is reported as a failure rather than a pass -
the wallet signed something else, so it vouches for nothing here.

## What a passing result does NOT mean

`codeHash` and `modelHash` are **self-reported by the build**. A modified build
could report the original values, so the verifier labels them `UNPROVEN` and
never counts them as verified. They are useful for spotting that two receipts
came from different builds; they are not evidence of what actually ran.

Closing that gap needs attestation from hardware the operator cannot forge,
which is the subject of later milestones - not something this tool can supply.

## A note on privacy

A bundle contains the prompt and response **in plaintext**. That is what makes
the hashes checkable: SHA-256 is one-way, so a verifier that only had hashes
could prove nothing. Exporting a receipt is therefore a deliberate act of
disclosing that exchange. Nothing is exported unless you ask for it, and the
prompt stored is always the post-redaction text - anything the ingress gateway
blocks as a secret never reaches a receipt or a bundle.

## Why this imports the app's own module

`verify-receipt.ts` imports `src/lib/assistant/receiptExport.ts` - the same code
the desktop app runs - instead of reimplementing the checks. A second copy would
be free to drift, and a verifier that disagrees with the thing it verifies is
worse than no verifier at all.
