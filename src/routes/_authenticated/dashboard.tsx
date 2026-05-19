import { createFileRoute, useRouter } from '@tanstack/react-router';
import { authClient } from '../../lib/auth-client';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleLogout = async () => {
    await authClient.signOut();
    router.invalidate();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const role = (user?.role ?? 'student') as string;
  const displayName = user?.name ?? 'User';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-3xl font-bold text-foreground">Welcome, {displayName}</h1>
      <p className="text-lg text-muted-foreground">
        You are logged in as a {role.charAt(0).toUpperCase() + role.slice(1)}
      </p>
      <nav className="flex flex-col gap-2">
        <a href="/assignments" className="text-primary hover:underline">
          Assignments
        </a>
        <a href="/consultations" className="text-primary hover:underline">
          Consultations
        </a>
        <a href="/settings" className="text-primary hover:underline">
          Settings
        </a>
      </nav>
      <button
        onClick={handleLogout}
        className="rounded bg-destructive px-4 py-2 font-medium text-destructive-foreground hover:bg-destructive/90"
      >
        Logout
      </button>
    </div>
  );
}
