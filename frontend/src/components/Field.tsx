import React, { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeProvider";
import {
  FontSize,
  FontWeight,
  Motion,
  Radius,
  Spacing,
  Tracking,
} from "@/src/theme/tokens";

type Props = TextInputProps & {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Renders the eye toggle and starts masked. */
  secure?: boolean;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  testID?: string;
};

/**
 * Text field with a focus ring.
 *
 * The old screens repeated the same bordered <View><TextInput/></View> block
 * on every form, which is why no two forms looked quite alike. This is the
 * single version of it: a label that stays put, a border that lights up on
 * focus, and an error line that pushes nothing around when it appears —
 * the slot below the field is always reserved.
 */
export function Field({
  label,
  icon,
  secure,
  error,
  hint,
  containerStyle,
  testID,
  ...input
}: Props) {
  const { colors } = useTheme();

  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);

  // Animating the border colour keeps focus from snapping visually.
  const progress = useRef(new Animated.Value(0)).current;

  const animate = (to: number) =>
    Animated.timing(progress, {
      toValue: to,
      duration: Motion.fast,
      useNativeDriver: false,
    }).start();

  const borderColor = error
    ? colors.error
    : (progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.border, colors.brand],
      }) as unknown as string);

  return (
    <View style={containerStyle}>
      {!!label && (
        <Text
          style={[
            styles.label,
            { color: focused ? colors.brand : colors.onSurfaceTertiary },
          ]}
        >
          {label}
        </Text>
      )}

      <Animated.View
        style={[
          styles.box,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor,
            // The ring is a second, softer border rather than a shadow: a
            // shadow on a dark background just looks like dirt.
            borderWidth: focused || error ? 1.5 : 1,
          },
        ]}
      >
        {!!icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.brand : colors.onSurfaceTertiary}
          />
        )}

        <TextInput
          testID={testID}
          {...input}
          secureTextEntry={hidden}
          placeholderTextColor={colors.onSurfaceTertiary}
          onFocus={(e) => {
            setFocused(true);
            animate(1);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            animate(0);
            input.onBlur?.(e);
          }}
          style={[styles.input, { color: colors.onSurface }]}
        />

        {secure && (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={18}
              color={colors.onSurfaceTertiary}
            />
          </Pressable>
        )}
      </Animated.View>

      {/* Reserved line — the layout never jumps when an error appears. */}
      <Text
        numberOfLines={1}
        style={[
          styles.help,
          { color: error ? colors.error : colors.onSurfaceTertiary },
        ]}
      >
        {error || hint || " "}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: Tracking.kicker,
    textTransform: "uppercase",
    marginBottom: 6,
    marginLeft: 2,
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    height: 54,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    paddingVertical: 0,
  },
  help: {
    fontSize: FontSize.xs,
    marginTop: 5,
    marginLeft: 2,
    minHeight: 14,
  },
});
