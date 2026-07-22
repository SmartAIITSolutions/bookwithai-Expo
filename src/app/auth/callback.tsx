// Landing target for the Google OAuth redirect (bookwithai://auth/callback).
// The actual code exchange happens in auth/index.tsx's handleGoogleSignIn,
// which captures the redirect result directly via WebBrowser.openAuthSessionAsync
// -- this just avoids a flash of "unmatched route" while that resolves and
// AuthRedirectGate picks up the new session.
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BreathingHeart } from '@/components/BreathingHeart';
import { Colors } from '@/constants/Theme';

export default function AuthCallbackLandingScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <BreathingHeart size={40} color={Colors.primary} />
      </View>
    </SafeAreaView>
  );
}
