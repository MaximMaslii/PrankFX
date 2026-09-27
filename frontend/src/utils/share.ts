/**
 * Sharing a finished result — photo or clip.
 *
 * Two things were wrong with the old flow. The photo screen handed React
 * Native's `Share` a `data:` URI, which Android ignores entirely: the caption
 * went out and the picture did not. And the five app icons under the image all
 * called the same function, so "Instagram" and "WhatsApp" did exactly the same
 * thing — the system sheet. Buttons that lie about where they lead are worse
 * than no buttons.
 *
 * What actually works without a native module:
 *   • the system share sheet, with a REAL file (expo-sharing), where TikTok
 *     and Instagram appear as targets;
 *   • or: save to the camera roll, then deep-link into the app, where the
 *     clip is the first thing in the picker.
 * The second is what the app-specific buttons do, and the label says so.
 */
import { Linking } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";

import { Toast } from "@/src/components/Toast";

export type SocialApp = "tiktok" | "instagram";

export const APP_LABEL: Record<SocialApp, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
};

/**
 * Deep links, most specific first.
 *
 * `canOpenURL` is deliberately not used: on Android 11+ it answers false for
 * any scheme the app has not declared in <queries>, so it would report every
 * app as missing. Opening and catching the rejection is the honest test.
 */
const APP_SCHEMES: Record<SocialApp, string[]> = {
  instagram: ["instagram://story-camera", "instagram://app"],
  tiktok: ["snssdk1233://", "tiktok://"],
};

/** Write a base64 image into the cache so it can be handed to the OS. */
export async function base64ToCacheFile(
  base64: string,
  filename: string,
): Promise<string> {
  const raw = base64.startsWith("data:") ? base64.split(",", 2)[1] : base64;
  const uri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, raw, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return uri;
}

async function openSocialApp(app: SocialApp): Promise<boolean> {
  for (const url of APP_SCHEMES[app]) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Not installed, or that scheme is gone in a newer version — try the
      // next one, then give up quietly and let the caller fall back.
    }
  }

  return false;
}

export type ShareOptions = {
  /** Local file URI — never a data: URI. */
  uri: string;
  mimeType: string;
  /** iOS only; ignored elsewhere. */
  uti?: string;
  dialogTitle: string;
  /** Copied to the clipboard so it is one paste away in the target app. */
  caption?: string;
  captionCopiedNotice?: string;
  /** Target app. Omit for the system share sheet. */
  app?: SocialApp;
  /** Puts the file in the camera roll before opening the app. */
  save?: () => Promise<boolean>;
  /** "Saved — pick it in TikTok" */
  savedNotice?: string;
};

export async function shareResult(options: ShareOptions): Promise<void> {
  const {
    uri,
    mimeType,
    uti,
    dialogTitle,
    caption,
    captionCopiedNotice,
    app,
    save,
    savedNotice,
  } = options;

  if (caption) {
    try {
      await Clipboard.setStringAsync(caption);

      if (captionCopiedNotice && !app) {
        Toast.success(captionCopiedNotice);
      }
    } catch {
      // A convenience, not a requirement.
    }
  }

  // App-specific route: the file has to exist in the gallery first, otherwise
  // the user lands in TikTok with nothing to pick.
  if (app) {
    const saved = save ? await save() : true;

    if (saved) {
      const opened = await openSocialApp(app);

      if (opened) {
        if (savedNotice) Toast.success(savedNotice);
        return;
      }
    }

    // App not installed (or the save failed) — the sheet still works.
  }

  if (!(await Sharing.isAvailableAsync())) {
    Toast.error("Sharing is not available on this device");
    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle,
    UTI: uti,
  });
}
