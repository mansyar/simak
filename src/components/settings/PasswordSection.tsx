import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useI18n } from '@/routes/__root';

export function PasswordSection() {
  const { t } = useI18n();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  const validate = (): string | null => {
    if (newPassword.length < 8) {
      return t('settings.password.passwordMinLength');
    }
    if (newPassword !== confirmPassword) {
      return t('settings.password.passwordMismatch');
    }
    return null;
  };

  const handleChangePassword = async () => {
    setSuccess('');
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsPending(true);
    try {
      await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      setSuccess(t('settings.password.passwordSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError(t('settings.password.passwordError'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t('settings.password.title')}
        </CardTitle>
        <CardDescription>{t('settings.password.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">{t('settings.password.currentPassword')}</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            aria-label={t('settings.password.currentPassword')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">{t('settings.password.newPassword')}</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            aria-label={t('settings.password.newPassword')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t('settings.password.confirmPassword')}</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-label={t('settings.password.confirmPassword')}
          />
        </div>

        {success && (
          <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 p-3 rounded-md">
            {success}
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
        )}

        <Button onClick={handleChangePassword} disabled={isPending}>
          {t('settings.password.changePassword')}
        </Button>
      </CardContent>
    </Card>
  );
}
