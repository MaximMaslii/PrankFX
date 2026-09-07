/**
 * Save a base64 PNG/JPEG image to the device's camera roll.
 *
 * Requires expo-media-library (works only on a real build — Expo Go on Android
 * cannot save due to scoped storage; iOS Expo Go asks for permission at runtime).
 */
import { Linking, Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { Toast } from "@/src/components/Toast";

const ALBUM = "PrankFX";

export async function saveBase64ToGallery(base64: string, filename = `prankfx_${Date.now()}.jpg`): Promise<boolean> {
  if (Platform.OS === "web") {
    // Trigger a browser download on web preview.
    try {
      const a = (globalThis as any).document?.createElement?.("a");
      if (a) {
        a.href = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
        a.download = filename;
        a.click();
        Toast.success("Downloaded");
        return true;
      }
      Toast.error("Save not supported on this platform");
      return false;
    } catch {
      Toast.error("Save failed");
      return false;
    }
  }

  // Permission flow
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) {
    if (!perm.canAskAgain) {
      Toast.error("Photos permission denied. Open Settings to allow.");
      Linking.openSettings().catch(() => {});
    } else {
      Toast.error("Photos permission is required");
    }
    return false;
  }

  try {
    const raw = base64.startsWith("data:") ? base64.split(",", 2)[1] : base64;
    const uri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, raw, { encoding: FileSystem.EncodingType.Base64 });

    const asset = await MediaLibrary.createAssetAsync(uri);
    try {
      const album = await MediaLibrary.getAlbumAsync(ALBUM);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(ALBUM, asset, false);
      }
    } catch {
      // Album operations are optional; asset is already saved.
    }

    Toast.success("Saved to Photos");
    return true;
  } catch (e: any) {
    Toast.error(e?.message || "Save failed");
    return false;
  }
}
