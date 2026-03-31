/**
 * Shared License Module
 * Types, constants, and pure functions for ExtensionPay license management.
 */

export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
export const PRICE_DISPLAY = '$4.99/month';
export const EXTPAY_ID = 'playbacklab';

export type LicenseStatus =
  | 'loading'
  | 'trial_active'
  | 'trial_expired'
  | 'paid'
  | 'past_due'
  | 'canceled'
  | 'no_trial';

export interface LicenseInfo {
  status: LicenseStatus;
  hasAccess: boolean;
  trialStartedAt: Date | null;
  trialDaysRemaining: number;
  paid: boolean;
  paidAt: Date | null;
  email: string | null;
  subscriptionStatus: string | null;
}

/**
 * Pure function: convert raw ExtPay user data to LicenseInfo.
 * Used by both background and panel to avoid duplicating trial logic.
 */
export function computeLicenseInfo(user: {
  paid: boolean;
  paidAt: Date | null;
  installedAt: Date | null;
  trialStartedAt: Date | null;
  email: string | null;
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | null;
}): LicenseInfo {
  // Paid user — always has access
  if (user.paid) {
    const status: LicenseStatus =
      user.subscriptionStatus === 'past_due' ? 'past_due' :
      user.subscriptionStatus === 'canceled' ? 'canceled' : 'paid';
    return {
      status,
      hasAccess: true,
      trialStartedAt: user.trialStartedAt,
      trialDaysRemaining: 0,
      paid: true,
      paidAt: user.paidAt,
      email: user.email,
      subscriptionStatus: user.subscriptionStatus,
    };
  }

  // Trial started
  if (user.trialStartedAt) {
    const elapsed = Date.now() - new Date(user.trialStartedAt).getTime();
    const remaining = Math.max(0, TRIAL_MS - elapsed);
    const daysRemaining = Math.ceil(remaining / (24 * 60 * 60 * 1000));

    if (remaining > 0) {
      return {
        status: 'trial_active',
        hasAccess: true,
        trialStartedAt: user.trialStartedAt,
        trialDaysRemaining: daysRemaining,
        paid: false,
        paidAt: null,
        email: user.email,
        subscriptionStatus: null,
      };
    }

    return {
      status: 'trial_expired',
      hasAccess: false,
      trialStartedAt: user.trialStartedAt,
      trialDaysRemaining: 0,
      paid: false,
      paidAt: null,
      email: user.email,
      subscriptionStatus: null,
    };
  }

  // No trial started yet
  return {
    status: 'no_trial',
    hasAccess: false,
    trialStartedAt: null,
    trialDaysRemaining: 0,
    paid: false,
    paidAt: null,
    email: user.email,
    subscriptionStatus: null,
  };
}
