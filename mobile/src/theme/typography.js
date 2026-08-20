// Loaded via @expo-google-fonts/{sora,inter} in App.js's useFonts() call.
export const fonts = {
  display: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
}

export const fontSizes = {
  // "Micro" in .claude/ui-ux.md's ladder and the HARD FLOOR — nothing renders below 11.
  micro: 11,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 28,
  // "Display L" in `.claude/ui-ux.md`'s size ladder — mobile's ladder stopped
  // at 28 because nothing needed larger until the launch screen, where the
  // wordmark carries the whole viewport on its own. Same 40 web uses, so the
  // two ladders stay one ladder.
  displayLarge: 40,
}

// How far CHROME may scale with the OS font setting, and nothing else.
//
// The rule this sits under, from `mobile/AGENTS.md` §6 and `.claude/ui-ux.md`:
// never disable `allowFontScaling`. Somebody who has turned text up to 200% has
// done so because they cannot read it otherwise, and switching that off for
// them is not a layout fix, it is refusing the request.
//
// So this is NOT a global cap and must never become one. Content — titles,
// prices, descriptions, form labels, body copy, empty states — scales all the
// way, and if that breaks a container the container is what gets fixed
// (`minHeight`, not `height`).
//
// What this is for is the narrow set of surfaces where BOTH of these hold:
//
//   1. the container is geometrically fixed — an 18dp circle is a circle, and a
//      tab bar is as tall as the OS drew it; and
//   2. the text is redundant — a "3" on a bell is also the three rows you see
//      the moment you tap it, and a tab label sits under an icon that already
//      names the destination.
//
// Where only the first holds, cap nothing and make the container grow. Where
// only the second holds, there is no problem to solve.
//
// 1.3 is the number `.claude/ui-ux.md` already names as the density every
// layout must survive, reused rather than invented so there is one figure to
// argue with.
export const CHROME_MAX_FONT_SCALE = 1.3
