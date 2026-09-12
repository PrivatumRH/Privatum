import { Router, type Request, type Response } from "express";

export const downloadsRouter = Router();

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || "PrivatumRH";
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

/**
 * Fetch releases from GitHub API with fallback to the public repository.
 */
async function fetchGithubReleases(): Promise<ReleaseResponse[]> {
  const token = getGitToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Privatum-Backend",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 1. Try configured repo
  try {
    const res = await fetch(`${GITHUB_API_BASE}/releases?per_page=30`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data as ReleaseResponse[];
      }
    }
  } catch (err) {
    // Ignore and proceed to public fallback
  }

  // 2. Try public repo if different from configured
  if (GITHUB_REPO_OWNER !== "PrivatumRH") {
    try {
      const res = await fetch(
        `https://api.github.com/repos/PrivatumRH/privatum/releases?per_page=30`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Privatum-Backend",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data as ReleaseResponse[];
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  return [];
}

interface MobileReleaseMatch {
  release: ReleaseResponse;
  apkAsset?: ReleaseAsset;
}

/**
 * Locate the latest release containing a mobile app bundle (APK/AAB) or tagged with mobile.
 */
function findLatestMobileRelease(releases: ReleaseResponse[]): MobileReleaseMatch | null {
  // Pass 1: Look for any release that contains an .apk or .aab asset
  for (const rel of releases) {
    const apkAsset = rel.assets?.find(
      (a) => a.name.endsWith(".apk") || a.name.endsWith(".aab")
    );
    if (apkAsset) {
      return { release: rel, apkAsset };
    }
  }

  // Pass 2: Look for any release whose tag or title mentions 'mobile' or 'android'
  for (const rel of releases) {
    const tag = (rel.tag_name || "").toLowerCase();
    const name = (rel.name || "").toLowerCase();
    if (
      tag.includes("mobile") ||
      tag.includes("android") ||
      name.includes("mobile") ||
      name.includes("android")
    ) {
      const apkAsset = rel.assets?.find(
        (a) => a.name.endsWith(".apk") || a.name.endsWith(".aab")
      );
      return { release: rel, apkAsset };
    }
  }

  // Pass 3: If any releases exist, return the latest release as a fallback
  if (releases.length > 0) {
    return { release: releases[0] };
  }

  return null;
}

// 1. Get metadata and download links for latest available desktop & overall release
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
      const apkAsset = assets.find((a) => a.name.endsWith(".apk")) || assets.find((a) => a.name.endsWith(".aab"));

      res.status(200).json({
        version: release.tag_name || "v0.1.0",
        releaseName: release.name || "PRIVATUM",
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
          android: {
            platform: "android",
            name: "Android (APK)",
            filename: apkAsset?.name || "privatum-mobile.apk",
            size: apkAsset?.size || 0,
            url: "/v1/downloads/android",
          },
        },
      });
      return;
    }

    // Fallback info if no formal release published
    res.status(200).json({
      version: "v0.1.0",
      releaseName: "PRIVATUM",
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
        android: {
          platform: "android",
          name: "Android (APK)",
          filename: "privatum-mobile.apk",
          url: "/v1/downloads/android",
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

// 2. Get metadata specifically for the latest mobile app release
downloadsRouter.get("/v1/downloads/mobile/latest", async (_req: Request, res: Response): Promise<void> => {
  try {
    const releases = await fetchGithubReleases();
    const match = findLatestMobileRelease(releases);

    if (match) {
      const { release, apkAsset } = match;
      res.status(200).json({
        version: release.tag_name || "v0.1.0",
        releaseName: release.name || "PRIVATUM Mobile",
        publishedAt: release.published_at,
        android: {
          platform: "android",
          name: "Android (APK)",
          filename: apkAsset?.name || "privatum-mobile.apk",
          size: apkAsset?.size || 0,
          url: "/v1/downloads/android",
          directUrl:
            apkAsset?.browser_download_url ||
            `https://github.com/PrivatumRH/privatum/releases/latest/download/privatum-mobile.apk`,
        },
        ios: {
          platform: "ios",
          status: "coming_soon",
          message: "iOS build coming soon",
        },
      });
      return;
    }

    // Graceful fallback when releases are pending
    res.status(200).json({
      version: "v0.1.0",
      releaseName: "PRIVATUM Mobile for Android",
      publishedAt: new Date().toISOString(),
      android: {
        platform: "android",
        name: "Android (APK)",
        filename: "privatum-mobile.apk",
        size: 0,
        url: "/v1/downloads/android",
        directUrl: `https://github.com/PrivatumRH/privatum/releases/latest/download/privatum-mobile.apk`,
      },
      ios: {
        platform: "ios",
        status: "coming_soon",
        message: "iOS build coming soon",
      },
    });
  } catch (error: any) {
    console.error("[downloads] Error fetching latest mobile release info:", error);
    res.status(500).json({
      error: "Failed to fetch mobile download information",
      details: error?.message,
    });
  }
});

// Alias for mobile info
downloadsRouter.get("/v1/downloads/mobile", (_req: Request, res: Response) => {
  res.redirect(307, "/v1/downloads/mobile/latest");
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
  android: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/privatum-mobile.apk`,
  apk: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/privatum-mobile.apk`,
};

// Aliases for mobile download routes
downloadsRouter.get("/v1/downloads/mobile/android", (_req: Request, res: Response) => {
  res.redirect(307, "/v1/downloads/android");
});

downloadsRouter.get("/v1/downloads/mobile/apk", (_req: Request, res: Response) => {
  res.redirect(307, "/v1/downloads/android");
});

// 3. Download endpoint for a given platform (windows, macos, linux, android, apk)
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
    // 1. Try checking latest release assets across releases
    const releases = await fetchGithubReleases();
    let targetAsset: ReleaseAsset | undefined;

    if (rawPlatform === "android" || rawPlatform === "apk") {
      const match = findLatestMobileRelease(releases);
      if (match?.apkAsset) {
        targetAsset = match.apkAsset;
      }
    } else {
      const latest = releases[0];
      const assets = latest?.assets || [];
      if (
        rawPlatform === "windows" ||
        rawPlatform === "win" ||
        rawPlatform === "exe" ||
        rawPlatform === "msi"
      ) {
        targetAsset =
          assets.find((a) => a.name.endsWith(".exe")) ||
          assets.find((a) => a.name.endsWith(".msi"));
      } else if (
        rawPlatform === "macos" ||
        rawPlatform === "mac" ||
        rawPlatform === "darwin" ||
        rawPlatform === "dmg"
      ) {
        targetAsset =
          assets.find((a) => a.name.endsWith(".dmg")) ||
          assets.find((a) => a.name.includes("app") || a.name.includes("aarch64"));
      } else if (
        rawPlatform === "linux" ||
        rawPlatform === "deb" ||
        rawPlatform === "appimage"
      ) {
        targetAsset =
          assets.find((a) => a.name.endsWith(".AppImage")) ||
          assets.find((a) => a.name.endsWith(".deb"));
      }
    }

    if (targetAsset) {
      if (token) {
        const downloadRes = await fetch(
          `${GITHUB_API_BASE}/releases/assets/${targetAsset.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/octet-stream",
              "User-Agent": "Privatum-Backend",
            },
            redirect: "manual",
          }
        );

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

    // 2. Fallback: Check workflow run artifacts if token is present
    if (token) {
      const artRes = await fetch(`${GITHUB_API_BASE}/actions/artifacts?per_page=20`, { headers });
      if (artRes.ok) {
        const artData = (await artRes.json()) as { artifacts: ArtifactItem[] };
        const artifacts = artData.artifacts || [];

        let targetArtifact: ArtifactItem | undefined;
        if (
          rawPlatform === "windows" ||
          rawPlatform === "win" ||
          rawPlatform === "exe"
        ) {
          targetArtifact = artifacts.find((a) => a.name === "privatum-windows-x64");
        } else if (
          rawPlatform === "macos" ||
          rawPlatform === "mac" ||
          rawPlatform === "darwin"
        ) {
          targetArtifact = artifacts.find((a) => a.name === "privatum-macos-arm64");
        } else if (
          rawPlatform === "linux" ||
          rawPlatform === "deb" ||
          rawPlatform === "appimage"
        ) {
          targetArtifact = artifacts.find((a) => a.name === "privatum-linux-x64");
        } else if (rawPlatform === "android" || rawPlatform === "apk") {
          targetArtifact = artifacts.find(
            (a) =>
              a.name === "privatum-mobile-apk" ||
              a.name.includes("mobile") ||
              a.name.includes("apk")
          );
        }

        if (targetArtifact) {
          const artDownloadRes = await fetch(
            `${GITHUB_API_BASE}/actions/artifacts/${targetArtifact.id}/zip`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "User-Agent": "Privatum-Backend",
              },
              redirect: "manual",
            }
          );

          const redirectUrl = artDownloadRes.headers.get("location");
          if (redirectUrl) {
            res.redirect(302, redirectUrl);
            return;
          }
        }
      }
    }

    // 3. Fallback: Redirect directly to release download URL
    const fallbackUrl =
      FALLBACK_DIRECT_URLS[rawPlatform] ||
      (rawPlatform === "android" || rawPlatform === "apk"
        ? "https://github.com/PrivatumRH/privatum/releases/latest/download/privatum-mobile.apk"
        : undefined);

    if (fallbackUrl) {
      res.redirect(302, fallbackUrl);
      return;
    }

    res.status(404).json({
      error: `No download package found for platform '${rawPlatform}'`,
      supportedPlatforms: ["windows", "macos", "linux", "android"],
    });
  } catch (error: any) {
    const fallbackUrl = FALLBACK_DIRECT_URLS[rawPlatform];
    if (fallbackUrl) {
      res.redirect(302, fallbackUrl);
      return;
    }
    console.error("[downloads] Download error:", error);
    res.status(500).json({
      error: "Failed to process download request",
      details: error?.message,
    });
  }
});
