import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View, ViewToken } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { SongFeedItem } from "@/components/feed/SongFeedItem";
import { engagementService } from "@/services/engagement.service";
import { feedService } from "@/services/feed.service";
import { useAuthStore } from "@/store/auth.store";
import { colors } from "@/theme/colors";

const PAGE_SIZE = 10;

export default function HomeScreen() {
  const session = useAuthStore((state) => state.session);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["home-feed", session?.access_token],
    queryFn: ({ pageParam }) =>
      feedService.getHomeFeed({
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    enabled: Boolean(session?.access_token),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
  });

  const songs = useMemo(() => query.data?.pages.flat() ?? [], [query.data?.pages]);

  const onViewableItemsChanged = ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const firstVisible = viewableItems[0]?.item as { id?: string } | undefined;
    setActiveSongId(firstVisible?.id ?? null);
  };

  return (
    <Screen>
      <Text style={styles.header}>For You</Text>
      <View style={styles.quickNav}>
        <Link href="/(app)/search" asChild>
          <Pressable style={styles.navChip}>
            <Text style={styles.navChipLabel}>Search</Text>
          </Pressable>
        </Link>
        <Link href="/(app)/upload" asChild>
          <Pressable style={styles.navChip}>
            <Text style={styles.navChipLabel}>Upload</Text>
          </Pressable>
        </Link>
        <Link href="/(app)/player" asChild>
          <Pressable style={styles.navChip}>
            <Text style={styles.navChipLabel}>Player</Text>
          </Pressable>
        </Link>
        <Link href="/(app)/playlist" asChild>
          <Pressable style={styles.navChip}>
            <Text style={styles.navChipLabel}>Playlists</Text>
          </Pressable>
        </Link>
        <Link href="/(app)/profile" asChild>
          <Pressable style={styles.navChip}>
            <Text style={styles.navChipLabel}>Profile</Text>
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={songs}
        renderItem={({ item }) => (
          <View style={styles.feedItem}>
            <SongFeedItem
              song={item}
              isActive={activeSongId === item.id}
              onLike={async (songId) => {
                if (!session?.access_token) return;
                await engagementService.likeSong(songId);
              }}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (!query.hasNextPage || query.isFetchingNextPage) return;
          query.fetchNextPage();
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 65 }}
        onViewableItemsChanged={onViewableItemsChanged}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No songs yet</Text>
            <Text style={styles.emptyBody}>Upload the first track and kickstart discovery.</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 12,
  },
  feedItem: {
    height: 560,
    marginBottom: 12,
  },
  quickNav: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  navChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  navChipLabel: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  empty: {
    marginTop: 120,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  emptyBody: {
    color: colors.textSecondary,
  },
});
