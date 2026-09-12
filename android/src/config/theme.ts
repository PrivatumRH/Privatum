export const THEME = {
  colors: {
    background: "#000000",
    surface: "#0e1015",
    surfaceElevated: "#151821",
    surfaceGlass: "rgba(21, 24, 33, 0.85)",

    border: "rgba(255, 255, 255, 0.08)",
    borderSubtle: "rgba(255, 255, 255, 0.04)",
    borderHighlight: "rgba(255, 255, 255, 0.2)",

    textPrimary: "#ffffff",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    textDim: "#475569",

    accent: "#ffffff",
    accentMuted: "rgba(255, 255, 255, 0.1)",

    danger: "#f43f5e",
    dangerMuted: "rgba(244, 63, 94, 0.12)",
    success: "#10b981",
    successMuted: "rgba(16, 185, 129, 0.12)",
    warning: "#f59e0b",
    warningMuted: "rgba(245, 158, 11, 0.12)",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
} as const;
