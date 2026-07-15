import { Redirect } from 'expo-router';

// Entry point — redirect to the Book tab
export default function Index() {
  return <Redirect href="/book" />;
}
