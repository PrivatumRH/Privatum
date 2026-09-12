import { Router, type Request, type Response as ExpressResponse } from "express";

export const downloadsRouter = Router();

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || "PrivatumRH";
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || "privatum";

// Primary actions repository where GitHub Actions runs execute and build artifacts are stored
const ACTIONS_REPO_OWNER = process.env.ACTIONS_REPO_OWNER || "NotADeveloper7";
const ACTIONS_REPO_NAME = process.env.ACTIONS_REPO_NAME || "privatum";

function getGitToken(): string {
  return (process.env.GIT_TOKEN || process.env.GITHUB_TOKEN || "").trim();
}

async function safeGithubFetch(url: string, init?: RequestInit): Promise<globalThis.Response> {
  try {
    return await fetch(url, init);
  } catch {
    // Retry once in case of temporary network or IPv6 resolution blip
    return await fetch(url, init);
  }
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
  created_at?: string;
  expired?: boolean;
}

interface ArtifactMatch {
  artifact: ArtifactItem;
  repo: string;
}

/**
 * Fetch releases from GitHub API across repositories:
 * checks ACTIONS_REPO (NotADeveloper7) first, then public GITHUB_REPO (PrivatumRH).
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

  const reposToTry = [
    `${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}`,
    ...(ACTIONS_REPO_OWNER !== GITHUB_REPO_OWNER ? [`${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`] : []),
  ];

  const allReleases: ReleaseResponse[] = [];

  for (const repo of reposToTry) {
    try {
      const res = await safeGithubFetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          allReleases.push(...(data as ReleaseResponse[]));
        }
      }
    } catch (err) {
      console.error(`[downloads] Error fetching releases from ${repo}:`, err);
    }
  }

  return allReleases;
}

interface MobileReleaseMatch {
  release: ReleaseResponse;
  apkAsset: ReleaseAsset;
}

/**
 * Locate the latest release containing an actual mobile app bundle (.apk or .aab).
 * Strictly requires an APK/AAB asset so backend/empty releases are ignored.
 */
function findLatestMobileRelease(releases: ReleaseResponse[]): MobileReleaseMatch | null {
  for (const rel of releases) {
    const apkAsset = rel.assets?.find(
      (a) => a.name.endsWith(".apk") || a.name.endsWith(".aab")
    );
    if (apkAsset) {
      return { release: rel, apkAsset };
    }
  }
  return null;
}

/**
 * Locate the latest release containing actual desktop binary assets.
 * Skips empty backend release tags.
 */
function findLatestDesktopRelease(releases: ReleaseResponse[]): ReleaseResponse | null {
  for (const rel of releases) {
    const hasDesktopAsset = (rel.assets || []).some(
      (a) =>
        a.name.endsWith(".exe") ||
        a.name.endsWith(".msi") ||
        a.name.endsWith(".dmg") ||
        a.name.endsWith(".AppImage") ||
        a.name.endsWith(".deb") ||
        a.name.includes("aarch64")
    );
    if (hasDesktopAsset) {
      return rel;
    }
  }
  return releases[0] || null;
}

/**
 * Locate the latest build artifact from GitHub Actions workflow runs.
 */
async function fetchLatestArtifact(platformName: string): Promise<ArtifactMatch | null> {
  const token = getGitToken();
  if (!token) return null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "Privatum-Backend",
  };

  const reposToTry = [
    `${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}`,
    ...(ACTIONS_REPO_OWNER !== GITHUB_REPO_OWNER ? [`${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`] : []),
  ];

  const p = platformName.toLowerCase();

  for (const repo of reposToTry) {
    try {
      const res = await safeGithubFetch(`https://api.github.com/repos/${repo}/actions/artifacts?per_page=30`, {
        headers,
      });
      if (!res.ok) continue;

      const data = (await res.json()) as { artifacts: ArtifactItem[] };
      const artifacts = (data.artifacts || []).filter((a) => !a.expired);

      let match: ArtifactItem | undefined;
      if (p === "android" || p === "apk" || p === "mobile") {
        match = artifacts.find(
          (a) =>
            a.name === "privatum-mobile-apk" ||
            a.name === "privatum-mobile" ||
            (a.name.includes("mobile") && a.name.includes("apk"))
        );
      } else if (p === "windows" || p === "win" || p === "exe" || p === "msi") {
        match = artifacts.find((a) => a.name === "privatum-windows-x64");
      } else if (p === "macos" || p === "mac" || p === "darwin" || p === "dmg") {
        match = artifacts.find((a) => a.name === "privatum-macos-arm64");
      } else if (p === "linux" || p === "deb" || p === "appimage") {
        match = artifacts.find((a) => a.name === "privatum-linux-x64");
      }

      if (match) {
        return { artifact: match, repo };
      }
    } catch (err) {
      console.error(`[downloads] Error querying artifacts for ${repo}:`, err);
    }
  }

  return null;
}

/**
 * Resolve the signed temporary download URL for a GitHub Actions artifact archive.
 */
async function getArtifactDownloadUrl(artifact: ArtifactItem, repo: string): Promise<string | null> {
  const token = getGitToken();
  if (!token) return null;

  try {
    const res = await safeGithubFetch(
      `https://api.github.com/repos/${repo}/actions/artifacts/${artifact.id}/zip`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "Privatum-Backend",
        },
        redirect: "manual",
      }
    );

    const redirectUrl = res.headers.get("location");
    if (redirectUrl) {
      return redirectUrl;
    }
  } catch (err) {
    console.error(`[downloads] Error obtaining artifact zip url for ${artifact.id}:`, err);
  }

  return null;
}

// 1. Get metadata and download links for latest available desktop & overall release
downloadsRouter.get("/v1/downloads/latest", async (_req: Request, res: ExpressResponse): Promise<void> => {
  try {
    const releases = await fetchGithubReleases();
    const release = findLatestDesktopRelease(releases);

    if (release) {
      const assets = release.assets || [];

      const winAsset = assets.find((a) => a.name.endsWith(".exe")) || assets.find((a) => a.name.endsWith(".msi"));
      const macAsset = assets.find((a) => a.name.endsWith(".dmg")) || assets.find((a) => a.name.includes("aarch64") || a.name.includes("app"));
      const linuxAsset = assets.find((a) => a.name.endsWith(".AppImage")) || assets.find((a) => a.name.endsWith(".deb"));

      const mobileMatch = findLatestMobileRelease(releases);
      const apkAsset = mobileMatch?.apkAsset;
      let androidSize = apkAsset?.size || 0;

      if (!apkAsset) {
        const artMatch = await fetchLatestArtifact("android");
        if (artMatch) {
          androidSize = artMatch.artifact.size_in_bytes;
        }
      }

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
            size: androidSize,
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
downloadsRouter.get("/v1/downloads/info", (_req: Request, res: ExpressResponse) => {
  res.redirect(307, "/v1/downloads/latest");
});

// 2. Get metadata specifically for the latest mobile app release
downloadsRouter.get("/v1/downloads/mobile/latest", async (_req: Request, res: ExpressResponse): Promise<void> => {
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
          filename: apkAsset.name || "privatum-mobile.apk",
          size: apkAsset.size || 0,
          url: "/v1/downloads/android",
          directUrl: apkAsset.browser_download_url || "/v1/downloads/android",
        },
        ios: {
          platform: "ios",
          status: "coming_soon",
          message: "iOS build coming soon",
        },
      });
      return;
    }

    // Fallback to GitHub Actions build artifact on NotADeveloper7/privatum
    const artMatch = await fetchLatestArtifact("android");
    if (artMatch) {
      const downloadUrl = await getArtifactDownloadUrl(artMatch.artifact, artMatch.repo);
      res.status(200).json({
        version: "v0.1.0",
        releaseName: "PRIVATUM Mobile",
        publishedAt: artMatch.artifact.created_at || new Date().toISOString(),
        android: {
          platform: "android",
          name: "Android (APK)",
          filename: "privatum-mobile.apk",
          size: artMatch.artifact.size_in_bytes,
          url: "/v1/downloads/android",
          directUrl: downloadUrl || "/v1/downloads/android",
        },
        ios: {
          platform: "ios",
          status: "coming_soon",
          message: "iOS build coming soon",
        },
      });
      return;
    }

    // Graceful fallback when builds are pending
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
        directUrl: "/v1/downloads/android",
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
downloadsRouter.get("/v1/downloads/mobile", (_req: Request, res: ExpressResponse) => {
  res.redirect(307, "/v1/downloads/mobile/latest");
});

const FALLBACK_DIRECT_URLS: Record<string, string> = {
  windows: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_x64-setup.exe`,
  win: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_x64-setup.exe`,
  exe: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_x64-setup.exe`,
  msi: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_x64-setup.exe`,
  macos: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_aarch64.app.tar.gz`,
  mac: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_aarch64.app.tar.gz`,
  darwin: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_aarch64.app.tar.gz`,
  dmg: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_aarch64.app.tar.gz`,
  linux: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_amd64.deb`,
  deb: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_amd64.deb`,
  appimage: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/latest/download/PRIVATUM_0.1.0_amd64.deb`,
  android: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/download/v0.1.13/privatum-mobile.apk`,
  apk: `https://github.com/${ACTIONS_REPO_OWNER}/${ACTIONS_REPO_NAME}/releases/download/v0.1.13/privatum-mobile.apk`,
};

// Aliases for mobile download routes
downloadsRouter.get("/v1/downloads/mobile/android", (_req: Request, res: ExpressResponse) => {
  res.redirect(307, "/v1/downloads/android");
});

downloadsRouter.get("/v1/downloads/mobile/apk", (_req: Request, res: ExpressResponse) => {
  res.redirect(307, "/v1/downloads/android");
});

// 3. Download endpoint for a given platform (windows, macos, linux, android, apk)
downloadsRouter.get("/v1/downloads/:platform", async (req: Request, res: ExpressResponse): Promise<void> => {
  const rawPlatform = (req.params.platform || "").toLowerCase();
  const token = getGitToken();

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
      const desktopRelease = findLatestDesktopRelease(releases);
      if (desktopRelease) {
        const assets = desktopRelease.assets || [];
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
    }

    if (targetAsset) {
      if (token && targetAsset.url) {
        try {
          const downloadRes = await safeGithubFetch(targetAsset.url, {
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
        } catch {
          // Fall through to browser download url
        }
      }

      if (targetAsset.browser_download_url) {
        res.redirect(302, targetAsset.browser_download_url);
        return;
      }
    }

    // 2. Fallback: Check workflow run artifacts from GitHub Actions on NotADeveloper7/privatum
    if (token) {
      const artMatch = await fetchLatestArtifact(rawPlatform);
      if (artMatch) {
        const redirectUrl = await getArtifactDownloadUrl(artMatch.artifact, artMatch.repo);
        if (redirectUrl) {
          res.redirect(302, redirectUrl);
          return;
        }
      }
    }

    // 3. Fallback: Direct desktop release URLs (if defined)
    const fallbackUrl = FALLBACK_DIRECT_URLS[rawPlatform];
    if (fallbackUrl) {
      res.redirect(302, fallbackUrl);
      return;
    }

    res.status(404).json({
      error: `No download package found for platform '${rawPlatform}'`,
      supportedPlatforms: ["windows", "macos", "linux", "android"],
    });
  } catch (error: any) {
    console.error("[downloads] Download error:", error);
    res.status(500).json({
      error: "Failed to process download request",
      details: error?.message,
    });
  }
});
