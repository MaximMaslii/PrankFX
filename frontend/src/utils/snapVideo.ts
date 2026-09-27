/**
 * Downloading, saving and sharing a finished Snap clip.
 *
 * The clip is fetched once to the cache and everything else — playback,
 * gallery, share sheet — works off that local file. Playing straight from the
 * API would mean re-sending the bearer token on every seek and would leave
 * nothing to hand the share sheet.
 */
import { Linking, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";

import { SnapAPI } from "@/src/api/client";
import { Toast } from "@/src/components/Toast";

const ALBUM = "PrankFX";

/** One hashtag, everywhere. A trend needs a name, and this is it. */
export const SNAP_HASHTAG = "#PrankFX";

export type SnapShareText = {
  /** Caption suggested to the user; copied to the clipboard before sharing. */
  caption: string;
  /** "Caption copied — paste it in TikTok" */
  copiedNotice: string;
  dialogTitle: string;
};

/**
 * Pull the finished clip into the app's cache directory.
 * Returns the local file URI.
 */
export async function downloadSnap(jobId: string): Promise<string> {
  const target = `${FileSystem.cacheDirectory}prankfx_snap_${jobId}.mp4`;

  const existing = await FileSystem.getInfoAsync(target);

  if (existing.exists && (existing.size ?? 0) > 0) {
    return target;
  }

  const headers = await SnapAPI.authHeaders();

  const result = await FileSystem.downloadAsync(
    SnapAPI.videoUrl(jobId),
    target,
    { headers },
  );

  if (result.status !== 200) {
    throw new Error(`Could not download the clip (HTTP ${result.status})`);
  }

  return result.uri;
}

/**
 * Save the clip to the camera roll, in a PrankFX album.
 */
export async function saveSnapToGallery(localUri: string): Promise<boolean> {
  if (Platform.OS === "web") {
    Toast.error("Saving is not supported in the web preview");
    return false;
  }

  const permission = await MediaLibrary.requestPermissionsAsync(true);

  if (!permission.granted) {
    if (!permission.canAskAgain) {
      Toast.error("Photos permission denied. Open Settings to allow.");
      Linking.openSettings().catch(() => {});
    } else {
      Toast.error("Photos permission is required");
    }
    return false;
  }

  try {
    const asset = await MediaLibrary.createAssetAsync(localUri);

    try {
      const album = await MediaLibrary.getAlbumAsync(ALBUM);

      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(ALBUM, asset, false);
      }
    } catch {
      // The asset is already in the camera roll; the album is a nicety.
    }

    return true;
  } catch (e: any) {
    Toast.error(e?.message || "Save failed");
    return false;
  }
}

/**
 * Hand the clip to TikTok through the system share sheet.
 *
 * TikTok's own Share Kit would attach the hashtag automatically and could
 * publish as a green-screen background, but it needs a native module, a client
 * key and app review. Until that lands, the caption goes to the clipboard so
 * it is one paste away, and the share sheet does the rest.
 */
export async function shareSnap(
  localUri: string,
  text: SnapShareText,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    Toast.error("Sharing is not available on this device");
    return;
  }

  try {
    await Clipboard.setStringAsync(text.caption);
    Toast.success(text.copiedNotice);
  } catch {
    // Clipboard is a convenience; carry on to the share sheet regardless.
  }

  await Sharing.shareAsync(localUri, {
    mimeType: "video/mp4",
    dialogTitle: text.dialogTitle,
    UTI: "public.mpeg-4",
  });
}
