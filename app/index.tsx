import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect immediately to the drawer group
  return <Redirect href="/main" />;
}