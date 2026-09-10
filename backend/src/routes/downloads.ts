import { Router, type Request, type Response } from "express";

export const downloadsRouter = Router();

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || "NotADeveloper7";
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || "privatum";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

function getGitToken(): string {
  return (process.env.GIT_TOKEN || process.env.GITHUB_TOKEN || "").trim();
}

interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
  url: string;
}

interface ReleaseResponse {
  tag_name: string;
  name: string;
  published_at: string;
  assets: ReleaseAsset[];
}

interface ArtifactItem {
  id: number;
  name: string;
  size_in_bytes: number;
  archive_download_url: string;
}

// 1. Get metadata and download links for latest available release
downloadsRouter.get("/v1/downloads/latest", async (_req: Request, res: Response): Promise<void> => {
  try {
    const token = getGitToken();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Privatum-Backend",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const relRes = await fetch(`${GITHUB_API_BASE}/releases/latest`, { headers });
    if (relRes.ok) {
      const release = (await relRes.json()) as ReleaseResponse;
      const assets = release.assets || [];

      const winAsset = assets.find((a) => a.name.endsWith(".exe")) || assets.find((a) => a.name.endsWith(".msi"));
      const macAsset = assets.find((a) => a.name.endsWith(".dmg")) || assets.find((a) => a.name.includes("aarch64") || a.name.includes("app"));
      const linuxAsset = assets.find((a) => a.name.endsWith(".AppImage")) || assets.find((a) => a.name.endsWith(".deb"));

      res.status(200).json({
        version: release.tag_name || "v0.1.0",
        releaseName: release.name || "PRIVATUM Desktop",
        publishedAt: release.published_at,
        downloads: {
          windows: {
            platform: "windows",
            name: "Windows (x64 Setup)",
            filename: winAsset?.name || "PRIVATUM_0.1.0_x64-setup.exe",
            size: winAsset?.size || 0,
            url: "/v1/downloads/windows",
          },
          macos: {
            platform: "macos",
            name: "macOS (Apple Silicon)",
            filename: macAsset?.name || "PRIVATUM_aarch64.app.tar.gz",
            size: macAsset?.size || 0,
            url: "/v1/downloads/macos",
          },
          linux: {
            platform: "linux",
            name: "Linux (Debian / AppImage)",
            filename: linuxAsset?.name || "PRIVATUM_0.1.0_amd64.deb",
            size: linuxAsset?.size || 0,
            url: "/v1/downloads/linux",
          },
        },
      });
      return;
    }

    // Fallback info if no formal release published
    res.status(200).json({
      version: "v0.1.0",
      releaseName: "PRIVATUM Desktop",
      downloads: {
        windows: {
          platform: "windows",
          name: "Windows (x64 Setup)",
          filename: "PRIVATUM_0.1.0_x64-setup.exe",
          url: "/v1/downloads/windows",
        },
        macos: {
          platform: "macos",
          name: "macOS (Apple Silicon)",
          filename: "PRIVATUM_aarch64.dmg",
          url: "/v1/downloads/macos",
        },
        linux: {
          platform: "linux",
          name: "Linux (x64)",
          filename: "PRIVATUM_0.1.0_amd64.deb",
          url: "/v1/downloads/linux",
        },
      },
    });
  } catch (error: any) {
    console.error("[downloads] Error fetching latest release info:", error);
    res.status(500).json({ error: "Failed to fetch download information", details: error?.message });
  }
});

// Alias for info
downloadsRouter.get("/v1/downloads/info", (_req: Request, res: Response) => {
  res.redirect(307, "/v1/downloads/latest");
});

const FALLBACK_DIRECT_URLS: Record<string, string> = {
  windows: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_x64-setup.exe`,
  win: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_x64-setup.exe`,
  exe: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_x64-setup.exe`,
  msi: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_x64-setup.exe`,
  macos: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_aarch64.app.tar.gz`,
  mac: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_aarch64.app.tar.gz`,
  darwin: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_aarch64.app.tar.gz`,
  dmg: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_aarch64.app.tar.gz`,
  linux: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_amd64.deb`,
  deb: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_amd64.deb`,
  appimage: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_amd64.deb`,
};

// 2. Download endpoint for a given platform
downloadsRouter.get("/v1/downloads/:platform", async (req: Request, res: Response): Promise<void> => {
  const rawPlatform = (req.params.platform || "").toLowerCase();
  const token = getGitToken();

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Privatum-Backend",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    // 1. Try checking latest release assets
    const relRes = await fetch(`${GITHUB_API_BASE}/releases/latest`, { headers });
    if (relRes.ok) {
      const release = (await relRes.json()) as ReleaseResponse;
      const assets = release.assets || [];

      let targetAsset: ReleaseAsset | undefined;
      if (rawPlatform === "windows" || rawPlatform === "win" || rawPlatform === "exe" || rawPlatform === "msi") {
        targetAsset = assets.find((a) => a.name.endsWith(".exe")) || assets.find((a) => a.name.endsWith(".msi"));
      } else if (rawPlatform === "macos" || rawPlatform === "mac" || rawPlatform === "darwin" || rawPlatform === "dmg") {
        targetAsset = assets.find((a) => a.name.endsWith(".dmg")) || assets.find((a) => a.name.includes("app") || a.name.includes("aarch64"));
      } else if (rawPlatform === "linux" || rawPlatform === "deb" || rawPlatform === "appimage") {
        targetAsset = assets.find((a) => a.name.endsWith(".AppImage")) || assets.find((a) => a.name.endsWith(".deb"));
      }

      if (targetAsset) {
        if (token) {
          const downloadRes = await fetch(`${GITHUB_API_BASE}/releases/assets/${targetAsset.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/octet-stream",
              "User-Agent": "Privatum-Backend",
            },
            redirect: "manual",
          });

          const redirectUrl = downloadRes.headers.get("location");
          if (redirectUrl) {
            res.redirect(302, redirectUrl);
            return;
          }
        }

        if (targetAsset.browser_download_url) {
          res.redirect(302, targetAsset.browser_download_url);
          return;
        }
      }
    }

    // 2. Fallback: Check workflow run artifacts if token is present
    if (token) {
      const artRes = await fetch(`${GITHUB_API_BASE}/actions/artifacts?per_page=20`, { headers });
      if (artRes.ok) {
        const artData = (await artRes.json()) as { artifacts: ArtifactItem[] };
        const artifacts = artData.artifacts || [];

        let targetArtifact: ArtifactItem | undefined;
        if (rawPlatform === "windows" || rawPlatform === "win" || rawPlatform === "exe") {
          targetArtifact = artifacts.find((a) => a.name === "privatum-windows-x64");
        } else if (rawPlatform === "macos" || rawPlatform === "mac" || rawPlatform === "darwin") {
          targetArtifact = artifacts.find((a) => a.name === "privatum-macos-arm64");
        } else if (rawPlatform === "linux" || rawPlatform === "deb" || rawPlatform === "appimage") {
          targetArtifact = artifacts.find((a) => a.name === "privatum-linux-x64");
        }

        if (targetArtifact) {
          const artDownloadRes = await fetch(`${GITHUB_API_BASE}/actions/artifacts/${targetArtifact.id}/zip`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "User-Agent": "Privatum-Backend",
            },
            redirect: "manual",
          });

          const redirectUrl = artDownloadRes.headers.get("location");
          if (redirectUrl) {
            res.redirect(302, redirectUrl);
            return;
          }
        }
      }
    }

    // 3. Fallback: Redirect directly to release download URL
    const fallbackUrl = FALLBACK_DIRECT_URLS[rawPlatform];
    if (fallbackUrl) {
      res.redirect(302, fallbackUrl);
      return;
    }

    res.status(404).json({
      error: `No download package found for platform '${rawPlatform}'`,
      supportedPlatforms: ["windows", "macos", "linux"],
    });
  } catch (error: any) {
    const fallbackUrl = FALLBACK_DIRECT_URLS[rawPlatform];
    if (fallbackUrl) {
      res.redirect(302, fallbackUrl);
      return;
    }
    console.error("[downloads] Download error:", error);
    res.status(500).json({ error: "Failed to process download request", details: error?.message });
  }
});
