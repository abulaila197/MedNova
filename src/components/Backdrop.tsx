import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { Grain } from "@/components/Grain";
import { BAKED_ART } from "@/features/start/baked";
import { useTheme } from "@/state/app";
import { useScreen } from "@/theme/scale";
import { tr } from '@/i18n';

// The page background (redesign stage 1, Yazan 2026-10-17): deep navy with the glow baked in and still, in the
// top-right and bottom-left corners. The header and dock show this same picture, so they run on from the page.
const SPOTS = [
  {
    x: 1.02,
    y: -0.02,
    rx: 0.95,
    ry: 0.32,
    rot: -32,
    c: "rgba(120,110,255,0.55)",
  },
  { x: 0.92, y: 0.04, rx: 0.5, ry: 0.14, rot: -32, c: "rgba(110,200,255,0.5)" },
  {
    x: -0.05,
    y: 1.02,
    rx: 0.85,
    ry: 0.28,
    rot: -28,
    c: "rgba(90,140,255,0.42)",
  },
];
const STRENGTH = 0.55;
const PAGE = require("@/assets/images/backdrop/page.webp");
// The same background with the still medical symbols baked in (scripts/bake-backdrop/bake-symbols.mjs, Yazan
// 2026-11-15, lag): one plain picture instead of ~40 live vector symbols. A tablet shape so they never stretch.
// Since 2026-11-16 all three are full phone resolution with the film grain baked in (bake-hd.py): no colour steps,
// and nothing else is drawn over them.
const PAGE_SYM = require("@/assets/images/backdrop/page-symbols-phone.webp");
const PAGE_SYM_TAB = require("@/assets/images/backdrop/page-symbols-tablet.webp");

/**
 * Full-screen background, pinned to the screen's top (pages, header) or bottom (the dock). `symbols` adds the still
 * medical line symbols (Yazan 2026-11-12, look A2) on the menu pages he approved; never in games or on pages with their own art.
 */
export function Backdrop({ anchor = "top", symbols = false, size }: { anchor?: "top" | "bottom"; symbols?: boolean; /** A fixed size (a veil's copy inside a column). */ size?: { width: number; height: number } }) {
  const t = useTheme();
  const screen = useScreen();
  const { width: w, height: h } = size ?? screen;
  return (
    <View
      pointerEvents="none"
      style={[
        s.box,
        { width: w, height: h, backgroundColor: t.sky },
        anchor === "top" ? { top: 0 } : { bottom: 0 },
      ]}
    >
      {symbols ? (
        <Image
          source={w / h > 0.6 ? PAGE_SYM_TAB : PAGE_SYM}
          contentFit="cover"
          contentPosition={anchor === "top" ? "top" : "bottom"}
          transition={0}
          accessibilityIgnoresInvertColors
          style={StyleSheet.absoluteFill}
        />
      ) : BAKED_ART ? (
        // The navy and all three glows in one opaque picture (scripts/bake-backdrop/bake-page.py), stretched to the
        // screen: one plain image per backdrop instead of three big rotated see-through ones (2026-10-19, lag).
        <Image source={PAGE} contentFit="fill" transition={0} accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
      ) : (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            {SPOTS.map((p, i) => (
              <RadialGradient key={i} id={`bd${i}`} cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor={p.c} stopOpacity={STRENGTH} />
                <Stop
                  offset="0.5"
                  stopColor={p.c}
                  stopOpacity={STRENGTH * 0.45}
                />
                <Stop offset="1" stopColor={p.c} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {SPOTS.map((p, i) => (
            <Ellipse
              key={i}
              cx={p.x * w}
              cy={p.y * h}
              rx={p.rx * w}
              ry={p.ry * h}
              fill={`url(#bd${i})`}
              transform={tr('rotate({rot} {n} {n2})', { rot: p.rot, n: p.x * w, n2: p.y * h })}
            />
          ))}
        </Svg>
      )}
      {/* The baked pictures carry the grain themselves (bake-hd.py, 2026-11-16); only the live fallback lays it on. */}
      {symbols || BAKED_ART ? null : <Grain />}
    </View>
  );
}

const s = StyleSheet.create({ box: { position: "absolute", left: 0 } });
