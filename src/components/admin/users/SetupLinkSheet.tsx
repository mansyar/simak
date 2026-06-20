import { useState } from 'react';
import { useI18n } from '@/routes/__root';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check } from 'lucide-react';

interface SetupLinkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

export function SetupLinkSheet({ open, onOpenChange, url }: SetupLinkSheetProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('adminUsers.setupLinkTitle')}</SheetTitle>
          <SheetDescription>{t('adminUsers.setupLinkDescription')}</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <Input readOnly value={url} className="font-mono text-sm" />
        </div>
        <div className="p-4 pt-0">
          <Button onClick={handleCopy} variant="outline" className="w-full">
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                {t('adminUsers.linkCopied')}
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                {t('common.copy')}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
