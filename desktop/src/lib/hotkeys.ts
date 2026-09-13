import { useEffect } from "react";

export interface ShortcutItem {
  key: string;
  label: string;
  description: string;
  category: "Transfers" | "Management" | "General";
}

export const SHORTCUTS_REGISTRY: ShortcutItem[] = [
  {
    key: "S",
    label: "Send Funds",
    description: "Open transfer dialog to send USDG or ETH with stealth option",
    category: "Transfers",
  },
  {
    key: "R",
    label: "Receive Funds",
    description: "Display deposit QR code and account address",
    category: "Transfers",
  },
  {
    key: "C",
    label: "Address Book",
    description: "Open private address book and contacts directory",
    category: "Management",
  },
  {
    key: "G",
    label: "Spending Guardrails",
    description: "Open 24-hour spending limit configuration and daily caps",
    category: "Management",
  },
  {
    key: "E",
    label: "Export Ledger",
    description: "Download local CSV or JSON transaction records and tax logs",
    category: "Management",
  },
  {
    key: "?",
    label: "Keyboard Shortcuts",
    description: "Show this keyboard reference cheat sheet",
    category: "General",
  },
  {
    key: "Esc",
    label: "Close / Dismiss",
    description: "Close active modal, drawer, or dialog",
    category: "General",
  },
];

/**
 * Checks whether an event target is an interactive text input or editable surface.
 * Hotkeys should not trigger while users are actively typing in forms.
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;

  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
    getAttribute?: (attr: string) => string | null;
  };

  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }

  if (el.isContentEditable) {
    return true;
  }

  if (typeof el.getAttribute === "function" && el.getAttribute("contenteditable") === "true") {
    return true;
  }

  return false;
}

export interface GlobalHotkeyHandlers {
  onSend?: () => void;
  onReceive?: () => void;
  onContacts?: () => void;
  onGuardrails?: () => void;
  onExport?: () => void;
  onHelp?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

/**
 * Pure evaluation function for dispatching hotkey actions.
 * Returns true if a registered hotkey was triggered and handled.
 */
export function handleGlobalHotkey(
  event: KeyboardEvent,
  handlers: GlobalHotkeyHandlers
): boolean {
  if (handlers.enabled === false) return false;

  const key = event.key;

  // Escape always triggers dismiss even if inside a form field
  if (key === "Escape") {
    if (handlers.onEscape) {
      handlers.onEscape();
      if (typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      return true;
    }
    return false;
  }

  // If user is actively typing in a text field, ignore all letter shortcuts
  if (isEditableElement(event.target)) {
    return false;
  }

  // Ignore modified keys (Ctrl, Cmd, Alt) to avoid hijacking OS and browser shortcuts
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  switch (key) {
    case "s":
    case "S":
      if (handlers.onSend) {
        handlers.onSend();
        if (typeof event.preventDefault === "function") event.preventDefault();
        return true;
      }
      break;

    case "r":
    case "R":
      if (handlers.onReceive) {
        handlers.onReceive();
        if (typeof event.preventDefault === "function") event.preventDefault();
        return true;
      }
      break;

    case "c":
    case "C":
      if (handlers.onContacts) {
        handlers.onContacts();
        if (typeof event.preventDefault === "function") event.preventDefault();
        return true;
      }
      break;

    case "g":
    case "G":
      if (handlers.onGuardrails) {
        handlers.onGuardrails();
        if (typeof event.preventDefault === "function") event.preventDefault();
        return true;
      }
      break;

    case "e":
    case "E":
      if (handlers.onExport) {
        handlers.onExport();
        if (typeof event.preventDefault === "function") event.preventDefault();
        return true;
      }
      break;

    case "?":
      if (handlers.onHelp) {
        handlers.onHelp();
        if (typeof event.preventDefault === "function") event.preventDefault();
        return true;
      }
      break;

    default:
      break;
  }

  return false;
}

/**
 * React hook subscribing to terminal hotkeys on window keydown.
 */
export function useGlobalHotkeys(handlers: GlobalHotkeyHandlers): void {
  useEffect(() => {
    if (handlers.enabled === false) return;

    function onKeyDown(e: KeyboardEvent) {
      handleGlobalHotkey(e, handlers);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    handlers.onSend,
    handlers.onReceive,
    handlers.onContacts,
    handlers.onGuardrails,
    handlers.onExport,
    handlers.onHelp,
    handlers.onEscape,
    handlers.enabled,
  ]);
}
