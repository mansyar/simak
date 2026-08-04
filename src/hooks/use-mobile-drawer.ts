import { useEffect, useRef, useState } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('aria-hidden'),
  );
}

interface UseMobileDrawerOptions {
  isOpen: boolean;
  onClose: () => void;
  triggerId?: string;
}

export function useMobileDrawer({
  isOpen,
  onClose,
  triggerId = 'mobile-menu-trigger',
}: UseMobileDrawerOptions) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener?.('change', updateIsMobile);
    return () => mediaQuery.removeEventListener?.('change', updateIsMobile);
  }, []);

  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const drawer = drawerRef.current;
    const appContent = document.querySelector<HTMLElement>('[data-app-content]');
    const wasContentInert = appContent?.inert ?? false;

    if (appContent) appContent.inert = true;

    const firstFocusable = closeButtonRef.current ?? getFocusableElements(drawer)[0];
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(drawer);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (appContent) appContent.inert = wasContentInert;
      document.getElementById(triggerId)?.focus();
    };
  }, [isOpen, triggerId]);

  return {
    drawerRef,
    closeButtonRef,
    isInactive: isMobile && !isOpen,
  };
}
