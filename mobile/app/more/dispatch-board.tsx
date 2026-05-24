import { Redirect } from 'expo-router';

export default function DispatchBoardRedirect() {
  return <Redirect href={'/more/team-ops' as any} />;
}
