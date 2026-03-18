import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
