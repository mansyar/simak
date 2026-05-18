import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold text-foreground">SIMAK</h1>
      <p className="text-lg text-muted-foreground">Sistem Informasi dan Manajemen Akademik</p>
      <p className="text-sm text-muted-foreground">Loading application...</p>
    </div>
  );
}
