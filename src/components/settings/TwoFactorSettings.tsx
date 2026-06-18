import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldOff, RefreshCw } from 'lucide-react';
import {
  getTwoFactorStatus,
  generateTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
} from '@/server/two-factor';
import { useI18n } from '@/routes/__root';

export function TwoFactorSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [isEnableDialogOpen, setIsEnableDialogOpen] = useState(false);
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [setupStep, setSetupStep] = useState<'password' | 'qr' | 'verify'>('password');

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['twoFactorStatus'],
    queryFn: async () => {
      const result = await (
        getTwoFactorStatus as unknown as (args: { data: Record<string, never> }) => Promise<unknown>
      )({ data: {} });
      return result as { enabled: boolean };
    },
  });

  const generateSetupMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const result = await (
        generateTwoFactorSetup as unknown as (args: {
          data: { password: string };
        }) => Promise<unknown>
      )({ data: { password: pwd } });
      return result as { totpURI?: string; backupCodes?: string[]; error?: string };
    },
    onSuccess: (data) => {
      if (data.error) {
        setError(data.error);
        return;
      }
      setTotpUri(data.totpURI ?? '');
      setBackupCodes(data.backupCodes ?? []);
      setSetupStep('qr');
      setError('');
    },
    onError: () => {
      setError(t('settings.twoFactor.setupError'));
    },
  });

  const enableMutation = useMutation({
    mutationFn: async (code: string) => {
      const result = await (
        enableTwoFactor as unknown as (args: {
          data: { code: string; trustDevice: boolean };
        }) => Promise<unknown>
      )({ data: { code, trustDevice: false } });
      return result as { success?: boolean; error?: string };
    },
    onSuccess: (data) => {
      if (data.error) {
        setError(data.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['twoFactorStatus'] });
      setIsEnableDialogOpen(false);
      resetSetup();
    },
    onError: () => {
      setError(t('settings.twoFactor.verifyError'));
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const result = await (
        disableTwoFactor as unknown as (args: { data: { password: string } }) => Promise<unknown>
      )({ data: { password: pwd } });
      return result as { success?: boolean; error?: string };
    },
    onSuccess: (data) => {
      if (data.error) {
        setError(data.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['twoFactorStatus'] });
      setIsDisableDialogOpen(false);
      setPassword('');
      setError('');
    },
    onError: () => {
      setError(t('settings.twoFactor.disableError'));
    },
  });

  const resetSetup = () => {
    setPassword('');
    setTotpCode('');
    setTotpUri('');
    setBackupCodes([]);
    setSetupStep('password');
    setError('');
  };

  const handleEnableSubmit = () => {
    if (setupStep === 'password') {
      generateSetupMutation.mutate(password);
    } else if (setupStep === 'verify') {
      enableMutation.mutate(totpCode);
    }
  };

  const handleDisableSubmit = () => {
    disableMutation.mutate(password);
  };

  const is2FAEnabled = statusData?.enabled ?? false;

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('settings.twoFactor.title')}
          </CardTitle>
          <CardDescription>{t('settings.twoFactor.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={is2FAEnabled ? 'default' : 'secondary'}>
                {is2FAEnabled ? t('settings.twoFactor.enabled') : t('settings.twoFactor.disabled')}
              </Badge>
            </div>
            <div className="flex gap-2">
              {is2FAEnabled ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDisableDialogOpen(true)}
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  {t('settings.twoFactor.disable')}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setIsEnableDialogOpen(true)}>
                  <Shield className="h-4 w-4 mr-2" />
                  {t('settings.twoFactor.enable')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enable 2FA Dialog */}
      <Dialog
        open={isEnableDialogOpen}
        onOpenChange={(open) => {
          setIsEnableDialogOpen(open);
          if (!open) resetSetup();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.twoFactor.enableTitle')}</DialogTitle>
            <DialogDescription>{t('settings.twoFactor.enableDescription')}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          {setupStep === 'password' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="enable-password">{t('settings.twoFactor.confirmPassword')}</Label>
                <Input
                  id="enable-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password')}
                />
              </div>
            </div>
          )}

          {setupStep === 'qr' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('settings.twoFactor.scanQR')}</p>
              <div className="flex justify-center p-6 bg-white rounded-lg">
                <QRCodeSVG
                  value={totpUri}
                  size={224}
                  level="M"
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setSetupStep('verify')}
              >
                {t('settings.twoFactor.continueToVerify')}
              </Button>
            </div>
          )}

          {setupStep === 'verify' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('settings.twoFactor.enterCode')}</p>
              <div className="space-y-2">
                <Label htmlFor="totp-code">{t('settings.twoFactor.totpCode')}</Label>
                <Input
                  id="totp-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                />
              </div>
              {backupCodes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t('settings.twoFactor.saveBackupCodes')}
                  </p>
                  <div className="p-3 bg-muted rounded-md font-mono text-xs">
                    {backupCodes.map((code, i) => (
                      <div key={i}>{code}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEnableDialogOpen(false);
                resetSetup();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleEnableSubmit}
              disabled={
                (setupStep === 'password' && !password) ||
                (setupStep === 'verify' && totpCode.length !== 6) ||
                generateSetupMutation.isPending ||
                enableMutation.isPending
              }
            >
              {generateSetupMutation.isPending || enableMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {setupStep === 'password' ? t('settings.twoFactor.setup') : t('common.verify')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog
        open={isDisableDialogOpen}
        onOpenChange={(open) => {
          setIsDisableDialogOpen(open);
          if (!open) {
            setPassword('');
            setError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.twoFactor.disableTitle')}</DialogTitle>
            <DialogDescription>{t('settings.twoFactor.disableDescription')}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="disable-password">{t('settings.twoFactor.confirmPassword')}</Label>
            <Input
              id="disable-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password')}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDisableDialogOpen(false);
                setPassword('');
                setError('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableSubmit}
              disabled={!password || disableMutation.isPending}
            >
              {disableMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              {t('settings.twoFactor.disable')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
