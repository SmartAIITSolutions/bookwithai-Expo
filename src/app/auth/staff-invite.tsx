// Landing target for the staff invite deep link (bookwithai://auth/staff-invite).
// The actual token exchange happens in the root _layout.tsx Linking listener,
// which fires on the same event and replaces this screen almost immediately --
// this just avoids a flash of "unmatched route" while that runs.
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Theme';

export default function StaffInviteLandingScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    </SafeAreaView>
  );
}
