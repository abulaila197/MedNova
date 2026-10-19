import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { Grain } from "@/components/Grain";
import { BAKED_ART } from "@/features/start/baked";
import { useTheme } from "@/state/app";
import { useScreen } from "@/theme/scale";

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
/** Each spot's gradient baked on a circle (scripts/bake-backdrop/bake.py), stretched and turned like the SVG ellipse. */
const GLOWS = [
  require("@/assets/images/backdrop/glow-1.png"),
  require("@/assets/images/backdrop/glow-2.png"),
  require("@/assets/images/backdrop/glow-3.png"),
];

/** Full-screen background, pinned to the screen's top (pages, header) or bottom (the dock). */
export function Backdrop({ anchor = "top" }: { anchor?: "top" | "bottom" }) {
  const t = useTheme();
  const { width: w, height: h } = useScreen();
  return (
    <View
      pointerEvents="none"
      style={[
        s.box,
        { width: w, height: h, backgroundColor: t.sky },
        anchor === "top" ? { top: 0 } : { bottom: 0 },
      ]}
    >
      {BAKED_ART ? (
        SPOTS.map((p, i) => (
          <Image
            key={i}
            source={GLOWS[i]}
            contentFit="fill"
            transition={0}
            accessibilityIgnoresInvertColors
            style={{
              position: "absolute",
              left: p.x * w - p.rx * w,
              top: p.y * h - p.ry * h,
              width: 2 * p.rx * w,
              height: 2 * p.ry * h,
              transform: [{ rotate: `${p.rot}deg` }],
            }}
          />
        ))
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
              transform={`rotate(${p.rot} ${p.x * w} ${p.y * h})`}
            />
          ))}
        </Svg>
      )}
      <Grain />
    </View>
  );
}

const s = StyleSheet.create({ box: { position: "absolute", left: 0 } });
