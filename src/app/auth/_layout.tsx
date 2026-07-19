import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="magic-link" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="biometrics" />
      <Stack.Screen name="pin-entry" />
      <Stack.Screen name="staff-invite" />
      <Stack.Screen name="staff-set-password" />
    </Stack>
  );
}
