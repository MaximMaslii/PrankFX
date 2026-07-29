/**
 * Camera / gallery pickers with graceful permission handling. Returns a
 * base64 payload ready to upload to the backend.
 */
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Linking, Platform } from "react-native";
import { Toast } from "@/src/components/Toast";

export type PickedImage = { base64: string; mime: string; uri: string };

async function processResult(res: ImagePicker.ImagePickerResult): Promise<PickedImage | null> {
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];

  // Downscale to ~1024 max side and compress to keep base64 payload small.
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  const base64 = manipulated.base64 || asset.base64 || "";
  if (!base64) {
    Toast.error("Could not read image");
    return null;
  }
  return { base64, mime: "image/jpeg", uri: manipulated.uri || asset.uri };
}

export async function pickFromGallery(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    if (!perm.canAskAgain && Platform.OS !== "web") {
      Toast.error("Media permission denied. Open Settings to allow.");
      Linking.openSettings().catch(() => {});
    } else {
      Toast.error("Media permission is required");
    }
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.9,
    base64: false,
  });
  return processResult(res);
}

export async function takePhoto(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    if (!perm.canAskAgain && Platform.OS !== "web") {
      Toast.error("Camera permission denied. Open Settings to allow.");
      Linking.openSettings().catch(() => {});
    } else {
      Toast.error("Camera permission is required");
    }
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.9,
    base64: false,
  });
  return processResult(res);
}
