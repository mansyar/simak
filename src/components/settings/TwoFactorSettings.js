import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
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
  const [backupCodes, setBackupCodes] = useState([]);
  const [error, setError] = useState('');
  const [setupStep, setSetupStep] = useState('password');
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['twoFactorStatus'],
    queryFn: async () => {
      const result = await getTwoFactorStatus({ data: {} });
      return result;
    },
  });
  const generateSetupMutation = useMutation({
    mutationFn: async (pwd) => {
      const result = await generateTwoFactorSetup({ data: { password: pwd } });
      return result;
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
    mutationFn: async (code) => {
      const result = await enableTwoFactor({ data: { code, trustDevice: false } });
      return result;
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
    mutationFn: async (pwd) => {
      const result = await disableTwoFactor({ data: { password: pwd } });
      return result;
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
    return _jsx(Card, {
      children: _jsx(CardContent, {
        className: 'flex items-center justify-center py-8',
        children: _jsx(RefreshCw, { className: 'h-5 w-5 animate-spin text-muted-foreground' }),
      }),
    });
  }
  return _jsxs(_Fragment, {
    children: [
      _jsxs(Card, {
        children: [
          _jsxs(CardHeader, {
            children: [
              _jsxs(CardTitle, {
                className: 'flex items-center gap-2',
                children: [_jsx(Shield, { className: 'h-5 w-5' }), t('settings.twoFactor.title')],
              }),
              _jsx(CardDescription, { children: t('settings.twoFactor.description') }),
            ],
          }),
          _jsx(CardContent, {
            children: _jsxs('div', {
              className: 'flex items-center justify-between',
              children: [
                _jsx('div', {
                  className: 'flex items-center gap-3',
                  children: _jsx(Badge, {
                    variant: is2FAEnabled ? 'default' : 'secondary',
                    children: is2FAEnabled
                      ? t('settings.twoFactor.enabled')
                      : t('settings.twoFactor.disabled'),
                  }),
                }),
                _jsx('div', {
                  className: 'flex gap-2',
                  children: is2FAEnabled
                    ? _jsxs(Button, {
                        variant: 'destructive',
                        size: 'sm',
                        onClick: () => setIsDisableDialogOpen(true),
                        children: [
                          _jsx(ShieldOff, { className: 'h-4 w-4 mr-2' }),
                          t('settings.twoFactor.disable'),
                        ],
                      })
                    : _jsxs(Button, {
                        size: 'sm',
                        onClick: () => setIsEnableDialogOpen(true),
                        children: [
                          _jsx(Shield, { className: 'h-4 w-4 mr-2' }),
                          t('settings.twoFactor.enable'),
                        ],
                      }),
                }),
              ],
            }),
          }),
        ],
      }),
      _jsx(Dialog, {
        open: isEnableDialogOpen,
        onOpenChange: (open) => {
          setIsEnableDialogOpen(open);
          if (!open) resetSetup();
        },
        children: _jsxs(DialogContent, {
          className: 'sm:max-w-md',
          children: [
            _jsxs(DialogHeader, {
              children: [
                _jsx(DialogTitle, { children: t('settings.twoFactor.enableTitle') }),
                _jsx(DialogDescription, { children: t('settings.twoFactor.enableDescription') }),
              ],
            }),
            error &&
              _jsx('div', {
                className: 'text-sm text-destructive bg-destructive/10 p-3 rounded-md',
                children: error,
              }),
            setupStep === 'password' &&
              _jsx('div', {
                className: 'space-y-4',
                children: _jsxs('div', {
                  className: 'space-y-2',
                  children: [
                    _jsx(Label, {
                      htmlFor: 'enable-password',
                      children: t('settings.twoFactor.confirmPassword'),
                    }),
                    _jsx(Input, {
                      id: 'enable-password',
                      type: 'password',
                      value: password,
                      onChange: (e) => setPassword(e.target.value),
                      placeholder: t('auth.password'),
                    }),
                  ],
                }),
              }),
            setupStep === 'qr' &&
              _jsxs('div', {
                className: 'space-y-4',
                children: [
                  _jsx('p', {
                    className: 'text-sm text-muted-foreground',
                    children: t('settings.twoFactor.scanQR'),
                  }),
                  _jsx('div', {
                    className: 'flex justify-center p-6 bg-white rounded-lg',
                    children: _jsx(QRCodeSVG, {
                      value: totpUri,
                      size: 224,
                      level: 'M',
                      bgColor: '#FFFFFF',
                      fgColor: '#000000',
                    }),
                  }),
                  _jsx(Button, {
                    variant: 'outline',
                    size: 'sm',
                    className: 'w-full',
                    onClick: () => setSetupStep('verify'),
                    children: t('settings.twoFactor.continueToVerify'),
                  }),
                ],
              }),
            setupStep === 'verify' &&
              _jsxs('div', {
                className: 'space-y-4',
                children: [
                  _jsx('p', {
                    className: 'text-sm text-muted-foreground',
                    children: t('settings.twoFactor.enterCode'),
                  }),
                  _jsxs('div', {
                    className: 'space-y-2',
                    children: [
                      _jsx(Label, {
                        htmlFor: 'totp-code',
                        children: t('settings.twoFactor.totpCode'),
                      }),
                      _jsx(Input, {
                        id: 'totp-code',
                        value: totpCode,
                        onChange: (e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)),
                        placeholder: '000000',
                        maxLength: 6,
                        pattern: '[0-9]*',
                        inputMode: 'numeric',
                      }),
                    ],
                  }),
                  backupCodes.length > 0 &&
                    _jsxs('div', {
                      className: 'space-y-2',
                      children: [
                        _jsx('p', {
                          className: 'text-xs text-muted-foreground',
                          children: t('settings.twoFactor.saveBackupCodes'),
                        }),
                        _jsx('div', {
                          className: 'p-3 bg-muted rounded-md font-mono text-xs',
                          children: backupCodes.map((code, i) =>
                            _jsx('div', { children: code }, i),
                          ),
                        }),
                      ],
                    }),
                ],
              }),
            _jsxs(DialogFooter, {
              children: [
                _jsx(Button, {
                  variant: 'outline',
                  onClick: () => {
                    setIsEnableDialogOpen(false);
                    resetSetup();
                  },
                  children: t('common.cancel'),
                }),
                _jsxs(Button, {
                  onClick: handleEnableSubmit,
                  disabled:
                    (setupStep === 'password' && !password) ||
                    (setupStep === 'verify' && totpCode.length !== 6) ||
                    generateSetupMutation.isPending ||
                    enableMutation.isPending,
                  children: [
                    generateSetupMutation.isPending || enableMutation.isPending
                      ? _jsx(RefreshCw, { className: 'h-4 w-4 animate-spin mr-2' })
                      : null,
                    setupStep === 'password' ? t('settings.twoFactor.setup') : t('common.verify'),
                  ],
                }),
              ],
            }),
          ],
        }),
      }),
      _jsx(Dialog, {
        open: isDisableDialogOpen,
        onOpenChange: (open) => {
          setIsDisableDialogOpen(open);
          if (!open) {
            setPassword('');
            setError('');
          }
        },
        children: _jsxs(DialogContent, {
          className: 'sm:max-w-md',
          children: [
            _jsxs(DialogHeader, {
              children: [
                _jsx(DialogTitle, { children: t('settings.twoFactor.disableTitle') }),
                _jsx(DialogDescription, { children: t('settings.twoFactor.disableDescription') }),
              ],
            }),
            error &&
              _jsx('div', {
                className: 'text-sm text-destructive bg-destructive/10 p-3 rounded-md',
                children: error,
              }),
            _jsxs('div', {
              className: 'space-y-2',
              children: [
                _jsx(Label, {
                  htmlFor: 'disable-password',
                  children: t('settings.twoFactor.confirmPassword'),
                }),
                _jsx(Input, {
                  id: 'disable-password',
                  type: 'password',
                  value: password,
                  onChange: (e) => setPassword(e.target.value),
                  placeholder: t('auth.password'),
                }),
              ],
            }),
            _jsxs(DialogFooter, {
              children: [
                _jsx(Button, {
                  variant: 'outline',
                  onClick: () => {
                    setIsDisableDialogOpen(false);
                    setPassword('');
                    setError('');
                  },
                  children: t('common.cancel'),
                }),
                _jsxs(Button, {
                  variant: 'destructive',
                  onClick: handleDisableSubmit,
                  disabled: !password || disableMutation.isPending,
                  children: [
                    disableMutation.isPending &&
                      _jsx(RefreshCw, { className: 'h-4 w-4 animate-spin mr-2' }),
                    t('settings.twoFactor.disable'),
                  ],
                }),
              ],
            }),
          ],
        }),
      }),
    ],
  });
}
