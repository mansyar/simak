import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';
import { getCurrentUser, updateProfile } from '@/server/settings';
import { useI18n } from '@/routes/__root';

export function ProfileSection() {
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const result = await (getCurrentUser as unknown as () => Promise<unknown>)();
      return result as {
        user: { id: string; name: string; email: string; image: string | null } | null;
        settings: { reducedMotion?: boolean } | null;
        error?: string;
      };
    },
  });

  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (data?.user?.name) {
      setName(data.user.name);
    }
  }, [data?.user?.name]);

  const updateNameMutation = useMutation({
    mutationFn: async (args: { name: string }) => {
      const result = await (
        updateProfile as unknown as (args: { data: { name: string } }) => Promise<unknown>
      )({ data: { name: args.name } });
      return result as { name?: string; error?: string };
    },
  });

  const handleSaveName = async () => {
    setError('');
    try {
      await updateNameMutation.mutateAsync({ name });
      toast.success(t('settings.profile.nameSuccess'));
    } catch {
      setError(t('settings.profile.nameError'));
    }
  };

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          {t('common.loading')}
        </CardContent>
      </Card>
    );
  }

  const user = data?.user;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {t('settings.profile.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden"
            aria-label={t('settings.profile.avatarLabel')}
          >
            {user?.image ? (
              <img src={user.image} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">
                {user?.name ? getInitials(user.name) : '??'}
              </span>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="profile-name">{t('settings.profile.nameLabel')}</Label>
          <div className="flex gap-2">
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={handleSaveName} disabled={updateNameMutation.isPending}>
              {t('settings.profile.saveName')}
            </Button>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label>{t('settings.profile.emailLabel')}</Label>
          <p className="text-sm text-muted-foreground">{user?.email ?? ''}</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
        )}
      </CardContent>
    </Card>
  );
}
