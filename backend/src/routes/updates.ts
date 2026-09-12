import { Router, type Request, type Response } from "express";

export const updatesRouter = Router();

interface PlatformRelease {
  version: string;
  pubDate: string;
  notes: string;
  downloadUrl: string;
  mandatory?: boolean;
}

// Current official releases by platform
const PLATFORM_RELEASES: Record<string, PlatformRelease> = {
  "linux-x86_64": {
    version: "0.1.11",
    pubDate: "2026-09-12T12:00:00Z",
    notes: "v0.1.11: Panic Freeze: stop the co-signer from signing anything, from any phone, with your authenticator code.",
    downloadUrl: "https://github.com/PrivatumRH/privatum/releases/download/v0.1.11/PRIVATUM_0.1.11_amd64.AppImage",
    mandatory: false,
  },
  "darwin-arm64": {
    version: "0.1.11",
    pubDate: "2026-09-12T12:00:00Z",
    notes: "v0.1.11: Panic Freeze: stop the co-signer from signing anything, from any phone, with your authenticator code.",
    downloadUrl: "https://github.com/PrivatumRH/privatum/releases/download/v0.1.11/PRIVATUM_0.1.11_aarch64.dmg",
    mandatory: false,
  },
  "windows-x86_64": {
    version: "0.1.11",
    pubDate: "2026-09-12T12:00:00Z",
    notes: "v0.1.11: Panic Freeze: stop the co-signer from signing anything, from any phone, with your authenticator code.",
    downloadUrl: "https://github.com/PrivatumRH/privatum/releases/download/v0.1.11/PRIVATUM_0.1.11_x64-setup.exe",
    mandatory: false,
  },
};

function parseSemver(v: string): number[] {
  const clean = v.replace(/^v/, "").split("-")[0];
  const parts = clean.split(".").map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

function isNewerVersion(candidate: string, current: string): boolean {
  const [cMaj, cMin, cPat] = parseSemver(candidate);
  const [uMaj, uMin, uPat] = parseSemver(current);
  if (cMaj !== uMaj) return cMaj > uMaj;
  if (cMin !== uMin) return cMin > uMin;
  return cPat > uPat;
}

updatesRouter.get("/v1/updates/desktop/:platform/:version", (req: Request, res: Response) => {
  const { platform, version } = req.params;
  const target = PLATFORM_RELEASES[platform] || PLATFORM_RELEASES["linux-x86_64"];

  if (!target) {
    return res.status(404).json({ error: "Platform not supported" });
  }

  const shouldUpdate = isNewerVersion(target.version, version);

  return res.json({
    shouldUpdate,
    currentVersion: version,
    latestVersion: target.version,
    releaseDate: target.pubDate,
    releaseNotes: target.notes,
    downloadUrl: target.downloadUrl,
    mandatory: target.mandatory ?? false,
  });
});

updatesRouter.get("/v1/updates/desktop/latest.json", (_req: Request, res: Response) => {
  return res.json({
    version: "0.1.11",
    pub_date: "2026-09-12T12:00:00Z",
    notes: "v0.1.11: Panic Freeze: stop the co-signer from signing anything, from any phone, with your authenticator code.",
    platforms: {
      "linux-x86_64": {
        url: "https://github.com/PrivatumRH/privatum/releases/download/v0.1.11/PRIVATUM_0.1.11_amd64.AppImage",
      },
      "darwin-aarch64": {
        url: "https://github.com/PrivatumRH/privatum/releases/download/v0.1.11/PRIVATUM_0.1.11_aarch64.dmg",
      },
      "windows-x86_64": {
        url: "https://github.com/PrivatumRH/privatum/releases/download/v0.1.11/PRIVATUM_0.1.11_x64-setup.exe",
      },
    },
  });
});
