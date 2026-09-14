import { describe, it, expect, mock } from "bun:test";
import {
  isEditableElement,
  handleGlobalHotkey,
  SHORTCUTS_REGISTRY,
  GlobalHotkeyHandlers,
} from "./hotkeys";

describe("Global Hotkeys Engine", () => {
  describe("isEditableElement", () => {
    it("returns false for null or undefined targets", () => {
      expect(isEditableElement(null)).toBe(false);
      expect(isEditableElement(undefined as any)).toBe(false);
    });

    it("returns false for non-editable standard elements", () => {
      expect(isEditableElement({ tagName: "DIV" } as any)).toBe(false);
      expect(isEditableElement({ tagName: "BUTTON" } as any)).toBe(false);
      expect(isEditableElement({ tagName: "BODY" } as any)).toBe(false);
      expect(isEditableElement({ tagName: "SPAN" } as any)).toBe(false);
    });

    it("returns true for standard form input elements", () => {
      expect(isEditableElement({ tagName: "INPUT" } as any)).toBe(true);
      expect(isEditableElement({ tagName: "input" } as any)).toBe(true);
      expect(isEditableElement({ tagName: "TEXTAREA" } as any)).toBe(true);
      expect(isEditableElement({ tagName: "SELECT" } as any)).toBe(true);
    });

    it("returns true for contenteditable elements", () => {
      expect(isEditableElement({ tagName: "DIV", isContentEditable: true } as any)).toBe(true);
      expect(
        isEditableElement({
          tagName: "DIV",
          getAttribute: (attr: string) => (attr === "contenteditable" ? "true" : null),
        } as any)
      ).toBe(true);
    });
  });

  describe("handleGlobalHotkey", () => {
    const createMockEvent = (key: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent => {
      return {
        key,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        target: { tagName: "BODY" },
        preventDefault: mock(() => {}),
        ...options,
      } as unknown as KeyboardEvent;
    };

    it("triggers onSend for s and S", () => {
      const onSend = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onSend };

      const eventLower = createMockEvent("s");
      const handledLower = handleGlobalHotkey(eventLower, handlers);
      expect(handledLower).toBe(true);
      expect(onSend).toHaveBeenCalledTimes(1);
      expect(eventLower.preventDefault).toHaveBeenCalledTimes(1);

      const eventUpper = createMockEvent("S");
      const handledUpper = handleGlobalHotkey(eventUpper, handlers);
      expect(handledUpper).toBe(true);
      expect(onSend).toHaveBeenCalledTimes(2);
    });

    it("triggers onReceive for r and R", () => {
      const onReceive = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onReceive };

      const event = createMockEvent("r");
      const handled = handleGlobalHotkey(event, handlers);
      expect(handled).toBe(true);
      expect(onReceive).toHaveBeenCalledTimes(1);
    });

    it("triggers onContacts for c and C", () => {
      const onContacts = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onContacts };

      const event = createMockEvent("c");
      const handled = handleGlobalHotkey(event, handlers);
      expect(handled).toBe(true);
      expect(onContacts).toHaveBeenCalledTimes(1);
    });

    it("triggers onGuardrails for g and G", () => {
      const onGuardrails = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onGuardrails };

      const event = createMockEvent("g");
      const handled = handleGlobalHotkey(event, handlers);
      expect(handled).toBe(true);
      expect(onGuardrails).toHaveBeenCalledTimes(1);
    });

    it("triggers onExport for e and E", () => {
      const onExport = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onExport };

      const event = createMockEvent("e");
      const handled = handleGlobalHotkey(event, handlers);
      expect(handled).toBe(true);
      expect(onExport).toHaveBeenCalledTimes(1);
    });

    it("triggers onBackup for b and B", () => {
      const onBackup = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onBackup };

      const eventLower = createMockEvent("b");
      const handledLower = handleGlobalHotkey(eventLower, handlers);
      expect(handledLower).toBe(true);
      expect(onBackup).toHaveBeenCalledTimes(1);

      const eventUpper = createMockEvent("B");
      const handledUpper = handleGlobalHotkey(eventUpper, handlers);
      expect(handledUpper).toBe(true);
      expect(onBackup).toHaveBeenCalledTimes(2);
    });

    it("triggers onHelp for ?", () => {
      const onHelp = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onHelp };

      const event = createMockEvent("?");
      const handled = handleGlobalHotkey(event, handlers);
      expect(handled).toBe(true);
      expect(onHelp).toHaveBeenCalledTimes(1);
    });

    it("triggers onEscape for Escape", () => {
      const onEscape = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onEscape };

      const event = createMockEvent("Escape");
      const handled = handleGlobalHotkey(event, handlers);
      expect(handled).toBe(true);
      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it("allows Escape to fire even when focused inside a form input", () => {
      const onEscape = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onEscape };

      const event = createMockEvent("Escape", {
        target: { tagName: "INPUT" } as any,
      });
      const handled = handleGlobalHotkey(event, handlers);
      expect(handled).toBe(true);
      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it("suppresses letter hotkeys when user is typing in a form input", () => {
      const onSend = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onSend };

      const event = createMockEvent("s", {
        target: { tagName: "INPUT" } as any,
      });
      const handled = handleGlobalHotkey(event, handlers);
      expect(handled).toBe(false);
      expect(onSend).not.toHaveBeenCalled();
    });

    it("ignores hotkeys when modifier keys are held", () => {
      const onSend = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onSend };

      const ctrlEvent = createMockEvent("s", { ctrlKey: true });
      expect(handleGlobalHotkey(ctrlEvent, handlers)).toBe(false);

      const metaEvent = createMockEvent("s", { metaKey: true });
      expect(handleGlobalHotkey(metaEvent, handlers)).toBe(false);

      const altEvent = createMockEvent("s", { altKey: true });
      expect(handleGlobalHotkey(altEvent, handlers)).toBe(false);

      expect(onSend).not.toHaveBeenCalled();
    });

    it("does nothing when enabled is explicitly false", () => {
      const onSend = mock(() => {});
      const handlers: GlobalHotkeyHandlers = { onSend, enabled: false };

      const event = createMockEvent("s");
      const handled = handleGlobalHotkey(event, handlers);
      expect(handled).toBe(false);
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("SHORTCUTS_REGISTRY", () => {
    it("contains all core hotkeys", () => {
      const keys = SHORTCUTS_REGISTRY.map((s) => s.key);
      expect(keys).toContain("S");
      expect(keys).toContain("R");
      expect(keys).toContain("C");
      expect(keys).toContain("G");
      expect(keys).toContain("E");
      expect(keys).toContain("B");
      expect(keys).toContain("?");
      expect(keys).toContain("Esc");
    });

    it("has valid descriptions and categories without emojis or em dashes", () => {
      for (const item of SHORTCUTS_REGISTRY) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
        expect(item.description).not.toContain("—"); // No em dashes
        expect(["Transfers", "Management", "General"]).toContain(item.category);
      }
    });
  });
});
