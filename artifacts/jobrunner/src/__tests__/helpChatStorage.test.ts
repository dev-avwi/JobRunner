import { describe, it, expect, beforeEach, vi } from "vitest";
import { HELP_CHAT_SESSION_KEY, clearChatHistory, getSessionGeneration } from "../lib/helpChatStorage";

describe("clearChatHistory", () => {
  let store: Record<string, string>;
  let sessionStorageMock: Storage;

  beforeEach(() => {
    store = {};
    sessionStorageMock = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() { return Object.keys(store).length; },
    };
    vi.stubGlobal("sessionStorage", sessionStorageMock);
  });

  it("removes the help_chat_history key from sessionStorage", () => {
    sessionStorage.setItem(HELP_CHAT_SESSION_KEY, JSON.stringify({ route: null, messages: [] }));
    expect(sessionStorage.getItem(HELP_CHAT_SESSION_KEY)).not.toBeNull();

    clearChatHistory();

    expect(sessionStorage.getItem(HELP_CHAT_SESSION_KEY)).toBeNull();
  });

  it("does nothing (no error) when sessionStorage has no chat history", () => {
    expect(sessionStorage.getItem(HELP_CHAT_SESSION_KEY)).toBeNull();
    expect(() => clearChatHistory()).not.toThrow();
    expect(sessionStorage.getItem(HELP_CHAT_SESSION_KEY)).toBeNull();
  });

  it("leaves other sessionStorage keys untouched", () => {
    const OTHER_KEY = "other_key";
    sessionStorage.setItem(OTHER_KEY, "preserved");
    sessionStorage.setItem(HELP_CHAT_SESSION_KEY, "history");

    clearChatHistory();

    expect(sessionStorage.getItem(HELP_CHAT_SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(OTHER_KEY)).toBe("preserved");
  });
});

describe("getSessionGeneration / clearChatHistory race guard", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() { return Object.keys(store).length; },
    });
  });

  it("bumps the session generation on each clearChatHistory call", () => {
    const gen0 = getSessionGeneration();
    clearChatHistory();
    expect(getSessionGeneration()).toBe(gen0 + 1);
    clearChatHistory();
    expect(getSessionGeneration()).toBe(gen0 + 2);
  });

  it("simulates the in-flight race: generation captured before logout differs after clearChatHistory", () => {
    // A mutation captures the generation when it starts
    const genAtSendTime = getSessionGeneration();

    // The user logs out while the request is in flight
    clearChatHistory();

    // The mutation callback would check: genAtSendTime === getSessionGeneration()
    // If they differ, it must NOT write to sessionStorage.
    const shouldPersist = genAtSendTime === getSessionGeneration();
    expect(shouldPersist).toBe(false);

    // Confirm the key remains absent even if a naïve callback tried to write
    if (shouldPersist) {
      sessionStorage.setItem(HELP_CHAT_SESSION_KEY, "leaked");
    }
    expect(sessionStorage.getItem(HELP_CHAT_SESSION_KEY)).toBeNull();
  });

  it("allows persistence when no logout occurred between send and settle", () => {
    const genAtSendTime = getSessionGeneration();

    // No logout — generation is unchanged when the mutation settles
    const shouldPersist = genAtSendTime === getSessionGeneration();
    expect(shouldPersist).toBe(true);
  });
});
