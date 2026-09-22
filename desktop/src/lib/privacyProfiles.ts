export type PrivacyProfile = "standard" | "private" | "maximum";

const STORAGE_KEY = "privatum_privacy_posture_profile";

export const PRIVACY_PROFILE_COPY: Record<PrivacyProfile, { label: string; description: string }> = {
  standard: { label: "Standard", description: "Normal transfer flow with privacy guidance." },
  private: { label: "Private", description: "Requires ERC-5564 stealth addressing." },
  maximum: { label: "Maximum Privacy", description: "Requires stealth addressing and acknowledgement of residual linkage signals." },
};

export function loadPrivacyProfile(): PrivacyProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "private" || saved === "maximum" ? saved : "standard";
  } catch {
    return "standard";
  }
}

export function savePrivacyProfile(profile: PrivacyProfile): void {
  localStorage.setItem(STORAGE_KEY, profile);
}

export function requiresStealthMetaAddress(profile: PrivacyProfile): boolean {
  return profile === "private" || profile === "maximum";
}
