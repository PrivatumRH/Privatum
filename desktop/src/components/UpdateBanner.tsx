import React, { useState, useEffect } from "react";
import { Download, Sparkles, X, ExternalLink } from "lucide-react";

interface UpdateInfo {
  shouldUpdate: boolean;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
}

interface UpdateBannerProps {
  currentVersion: string;
  apiUrl: string;
}

export function UpdateBanner({ currentVersion, apiUrl }: UpdateBannerProps) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    async function checkUpdate() {
      try {
        const platform = "linux-x86_64"; // Default target
        const res = await fetch(`${apiUrl}/v1/updates/desktop/${platform}/${currentVersion}`);
        if (res.ok) {
          const data = await res.json();
          if (data.shouldUpdate) {
            setUpdateInfo(data);
          }
        }
      } catch {
        // Silently continue if update server is unreachable
      }
    }

    checkUpdate();
  }, [currentVersion, apiUrl]);

  if (!updateInfo || dismissed) return null;

  return (
    <div className="w-full bg-gradient-to-r from-red-600/90 to-rose-600/90 text-white px-4 py-2 flex items-center justify-between text-xs border-b border-red-500/30 backdrop-blur-md shadow-md">
      <div className="flex items-center gap-2">
        <span className="p-1 rounded bg-black/20">
          <Sparkles className="w-3.5 h-3.5" />
        </span>
        <span className="font-semibold">
          PRIVATUM v{updateInfo.latestVersion} is available
        </span>
        <span className="text-white/80 hidden sm:inline">- {updateInfo.releaseNotes}</span>
      </div>

      <div className="flex items-center gap-3">
        <a
          href={updateInfo.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-bold underline text-white hover:text-white/90"
        >
          <span>Download Update</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-black/20 rounded text-white/80 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
