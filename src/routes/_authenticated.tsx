import { createFileRoute, redirect, Outlet, useMatchRoute } from '@tanstack/react-router';
import { getSessionFromHeaders } from '../server/auth';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { KeyboardCheatSheet } from '@/components/keyboard-cheat-sheet';

function AuthenticatedLayout() {
  const { cheatSheetOpen, setCheatSheetOpen } = useKeyboardShortcuts();

  const matchRoute = useMatchRoute();
  const reviewMatch = matchRoute({
    to: '/instructor/reviews/$submissionId',
  });

  return (
    <>
      <Outlet />
      <KeyboardCheatSheet
        isOpen={cheatSheetOpen}
        onClose={() => setCheatSheetOpen(false)}
        isReviewPage={!!reviewMatch}
      />
    </>
  );
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await getSessionFromHeaders();
    if (!session) {
      throw redirect({ to: '/auth/login' as unknown as '.' });
    }
  },
  component: AuthenticatedLayout,
});
