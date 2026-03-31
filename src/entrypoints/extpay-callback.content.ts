/**
 * ExtPay Callback Content Script
 * Required for onPaid/onTrialStarted listeners to fire after user completes
 * payment or trial signup on extensionpay.com.
 * WXT auto-registers this from the entrypoint filename.
 */

import ExtPay from 'extpay';
import { EXTPAY_ID } from '../shared/license';

export default defineContentScript({
  matches: ['https://extensionpay.com/*'],
  runAt: 'document_start',
  main() {
    ExtPay(EXTPAY_ID);
  },
});
