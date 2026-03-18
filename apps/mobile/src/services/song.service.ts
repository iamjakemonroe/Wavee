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
  coverUri?: string;
}

export const songService = {
  async pickAudioFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/mpeg", "audio/wav", "audio/x-wav"],
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
    formData.append("audio", {
      uri: assets.audioUri,
      name: "song.mp3",
      type: "audio/mpeg",
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
