// Guided install for the Lados browser extension (desktop only).
// Shown once after the vault is unlocked; also reachable from Settings.
import { backend } from "../services/backend";
import type { BrowserPresence } from "../types";
import { h, type Child } from "../ui/dom";
import { showDialog } from "../ui/modal";
import { toast } from "../ui/toast";

type BrowserId = "firefox" | "chrome" | "edge" | "opera";

/**
 * Store pages per browser. Set the URL once the add-on is published there;
 * leave `null` while it is still pending review (the entry shows as unavailable).
 */
const STORES: Record<BrowserId, { label: string; url: string | null }> = {
  firefox: { label: "Firefox", url: "https://addons.mozilla.org/en-US/firefox/addon/lados/" },
  chrome: { label: "Chrome", url: null },
  edge: { label: "Edge", url: null },
  opera: { label: "Opera", url: null },
};

/** Where to get the browser itself, for when it is not installed yet. */
const BROWSER_DOWNLOADS: Record<BrowserId, string> = {
  firefox: "https://www.mozilla.org/firefox/new/",
  chrome: "https://www.google.com/chrome/",
  edge: "https://www.microsoft.com/edge",
  opera: "https://www.opera.com/download",
};

/** Order shown in the dialog. */
const ORDER: BrowserId[] = ["firefox", "chrome", "edge", "opera"];

const DISMISSED_KEY = "lados-browser-extension-dismissed";

export function extensionAlreadyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markExtensionDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Ignore storage errors.
  }
}

/** Opens an external page through the Rust opener (a webview cannot open URLs itself). */
async function openUrl(url: string, what: string): Promise<void> {
  try {
    await backend.openExternalUrl(url);
    toast(`Opening ${what} in your browser.`, "info");
  } catch {
    toast(`Could not open your browser. Visit ${url}`, "error");
  }
}

/** Where a browser is sent while its store listing is still in review; the page
 *  redirects to the store the moment the listing is live, so publishing a store
 *  never needs an app release. */
const EXTENSION_PAGE = "https://ladospwm.vercel.app/extension";

/** Opens a browser's published store page, or the Lados extension page that will
 *  redirect there once it is published. The page opens in that browser itself (so
 *  Firefox's page does not land in Chrome, which would offer Firefox). */
export async function openExtensionStore(id: BrowserId = "firefox"): Promise<void> {
  const store = STORES[id];
  const url = store.url ?? `${EXTENSION_PAGE}#${id}`;
  try {
    await backend.openInBrowser(id, url);
    toast(
      store.url
        ? `Opening the ${store.label} add-on page in ${store.label}.`
        : `Opening the Lados extension page in ${store.label}.`,
      "info",
    );
  } catch {
    toast(`Could not open ${store.label}. Visit ${url}`, "error");
  }
}

/** Opens a browser's download page, for when it is not installed yet. */
export async function openBrowserDownload(id: BrowserId = "firefox"): Promise<void> {
  await openUrl(BROWSER_DOWNLOADS[id], `the ${STORES[id].label} download page`);
}

function actionButton(label: string, action: () => void, primary = false): HTMLElement {
  return h("button", { type: "button", class: ["button", primary ? "primary" : ""], onClick: action }, label);
}

/** One entry per installed browser: an "Add to <browser>" button when that browser has a store
 *  listing, or a note while the listing is still in review. With none installed, offer downloads. */
function browserChoices(browsers: BrowserPresence): Child[] {
  const installed = ORDER.filter((id) => browsers[id]);
  if (installed.length === 0) {
    return [
      h("p", { class: "muted", text: "You need a browser first - they are free:" }),
      h(
        "div",
        { class: "browser-choices" },
        actionButton("Download Firefox", () => void openBrowserDownload("firefox"), true),
        actionButton("Download Chrome", () => void openBrowserDownload("chrome")),
      ),
    ];
  }

  const buttons = installed.map((id) =>
    actionButton(`Add to ${STORES[id].label}`, () => void openExtensionStore(id), true),
  );

  return [
    h("p", { class: "muted", text: "Add the extension in the browser you use:" }),
    h("div", { class: "browser-choices" }, ...buttons),
    h("p", {
      class: "field-hint",
      text: "Each button opens the right page for that browser. There is no file to download.",
    }),
  ];
}

/** The install dialog, shared by the first-run prompt and the Settings button. */
export async function extensionInstallDialog(): Promise<void> {
  const browsers: BrowserPresence = await backend
    .detectedBrowsers()
    .catch(() => ({ firefox: false, chrome: false, edge: false, opera: false }));

  await showDialog<"done">({
    title: "Autofill in your browser",
    size: "medium",
    body: h(
      "div",
      { class: "stack", style: "gap: 14px" },
      h("p", {}, "The Lados extension fills logins from your vault. It works offline, with no account."),
      ...browserChoices(browsers),
      h(
        "p",
        { class: "muted" },
        "The same extension runs in Firefox, Chrome, Edge and Opera, and talks only to Lados on this computer.",
      ),
    ),
    submitLabel: "Close",
    hideCancel: true,
    onSubmit: () => "done",
  });
}

export async function maybeShowExtensionInstall(): Promise<void> {
  // The extension talks to the desktop app; there is nothing to install on mobile.
  if (await backend.isMobileShell().catch(() => false)) return;
  if (extensionAlreadyDismissed()) return;

  await extensionInstallDialog();
  // Shown once: from now on the Settings entry is the place to install it.
  markExtensionDismissed();
}
