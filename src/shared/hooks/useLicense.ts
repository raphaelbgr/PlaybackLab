/**
 * useLicense Hook
 * Manages license state from ExtPay background service.
 */

import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store';
import type { LicenseInfo } from '../license';

export function useLicense() {
  const license = useStore((state) => state.license);
  const setLicense = useStore((state) => state.setLicense);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch license on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'CHECK_LICENSE' }, (response) => {
      if (chrome.runtime.lastError) {
        console.debug('[useLicense] CHECK_LICENSE failed:', chrome.runtime.lastError.message);
        setIsLoading(false);
        return;
      }
      if (response?.license) {
        setLicense(response.license);
      }
      setIsLoading(false);
    });
  }, [setLicense]);

  // Listen for LICENSE_UPDATED broadcasts from background
  useEffect(() => {
    const handleMessage = (message: { type: string; payload?: LicenseInfo }) => {
      if (message.type === 'LICENSE_UPDATED' && message.payload) {
        setLicense(message.payload);
        setIsLoading(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [setLicense]);

  const startTrial = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'START_TRIAL' });
  }, []);

  const openPayment = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'OPEN_PAYMENT' });
  }, []);

  const openLogin = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'OPEN_LOGIN' });
  }, []);

  const refreshLicense = useCallback(() => {
    setIsLoading(true);
    chrome.runtime.sendMessage({ type: 'REFRESH_LICENSE' }, (response) => {
      if (response?.license) {
        setLicense(response.license);
      }
      setIsLoading(false);
    });
  }, [setLicense]);

  return {
    license,
    isLoading,
    hasAccess: license?.hasAccess ?? true, // default true while loading
    startTrial,
    openPayment,
    openLogin,
    refreshLicense,
  };
}
