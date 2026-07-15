import { Redirect } from 'expo-router';

// Auth is now handled silently via anonymous sign-in in the root layout.
export default function SignIn() {
  return <Redirect href="/" />;
}
