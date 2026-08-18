import Svg, { Defs, LinearGradient, Stop, Rect, Path, Line, Text as SvgText } from 'react-native-svg';

// Direct port of booking-app/public/logo-sanaa-white.svg (the one SANAA
// brand asset that actually exists) into react-native-svg primitives --
// no new mark invented, since no avatar/mascot exists anywhere today.
interface SanaaWordmarkProps {
  width?: number;
  height?: number;
  showTagline?: boolean;
}

export function SanaaWordmark({ width = 160, height = 56, showTagline = true }: SanaaWordmarkProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 70">
      <Defs>
        <LinearGradient id="snw1" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#7C3AED" />
          <Stop offset="100%" stopColor="#C9A84C" />
        </LinearGradient>
        <LinearGradient id="snw2" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#7C3AED" />
          <Stop offset="100%" stopColor="#C9A84C" />
        </LinearGradient>
      </Defs>
      <Rect x="18" y="8" width="13" height="22" rx="6.5" fill="url(#snw1)" />
      <Path d="M10,28 Q10,43 24,43 Q38,43 38,28" fill="none" stroke="url(#snw1)" strokeWidth="1.7" strokeLinecap="round" />
      <Line x1="24" y1="43" x2="24" y2="52" stroke="url(#snw1)" strokeWidth="1.7" strokeLinecap="round" />
      <Line x1="16" y1="52" x2="32" y2="52" stroke="url(#snw1)" strokeWidth="1.7" strokeLinecap="round" />
      <Path d="M43,21 Q49,32 43,43" fill="none" stroke="#7C3AED" strokeWidth="1.7" strokeLinecap="round" opacity={0.9} />
      <Path d="M49,16 Q57,32 49,48" fill="none" stroke="url(#snw2)" strokeWidth="1.3" strokeLinecap="round" opacity={0.65} />
      <Path d="M55,12 Q65,32 55,52" fill="none" stroke="#C9A84C" strokeWidth="1" strokeLinecap="round" opacity={0.35} />
      <SvgText x="74" y="28" fontFamily="Sora_700Bold" fontSize="22" fill="url(#snw1)">SANAA</SvgText>
      {showTagline && (
        <SvgText x="74" y="43" fontFamily="Sora_400Regular" fontSize="9" letterSpacing={2} fill="rgba(255,255,255,0.45)">
          AI RECEPTIONIST
        </SvgText>
      )}
    </Svg>
  );
}
