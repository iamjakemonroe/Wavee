import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { Song } from "@/types/entities";

interface CreateSongPayload {
  title: string;
  genre: string;
}

interface UploadAssets {
  audioUri: string;
  /** From DocumentPicker; used so M4A sends audio/mp4 + .m4a, not fake mp3. */
  audioName?: string;
  audioMime?: string;
  coverUri?: string;
}

export const songService = {
  async pickAudioFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return null;
    return result.assets[0];
  },

  async pickCoverImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Media library permission is required to select cover image.");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return null;
    return result.assets[0];
  },

  async createSong(payload: CreateSongPayload, assets: UploadAssets) {
    const formData = new FormData();
    formData.append("title", payload.title);
    formData.append("genre", payload.genre);

    const mime = assets.audioMime?.toLowerCase() ?? "";
    const nameLower = assets.audioName?.toLowerCase() ?? "";
    let audioType = assets.audioMime ?? "audio/mpeg";
    let audioName = assets.audioName ?? "song.mp3";
    if (!assets.audioMime && nameLower.endsWith(".m4a")) {
      audioType = "audio/mp4";
      audioName = assets.audioName ?? "song.m4a";
    } else if (!assets.audioMime && (nameLower.endsWith(".wav") || nameLower.endsWith(".wave"))) {
      audioType = "audio/wav";
      audioName = assets.audioName ?? "song.wav";
    } else if (mime.includes("mp4") || mime.includes("m4a")) {
      audioType = assets.audioMime ?? "audio/mp4";
      if (!audioName.toLowerCase().endsWith(".m4a")) audioName = "song.m4a";
    }

    formData.append("audio", {
      uri: assets.audioUri,
      name: audioName,
      type: audioType,
    } as unknown as Blob);
    if (assets.coverUri) {
      formData.append("cover", {
        uri: assets.coverUri,
        name: "cover.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
    }

    return api.postFormData<Song>("/v1/songs/upload", formData);
  },
};
