/**
 * Type declarations for vendor packages without types
 */

declare module 'm3u8-parser' {
  export class Parser {
    push(chunk: string): void;
    end(): void;
    manifest: {
      playlists?: Array<{
        uri: string;
        attributes?: {
          BANDWIDTH?: number;
          RESOLUTION?: { width: number; height: number };
          CODECS?: string;
          'FRAME-RATE'?: number;
        };
      }>;
      mediaGroups?: {
        AUDIO?: Record<string, Record<string, {
          uri?: string;
          language?: string;
          name?: string;
          channels?: string;
          attributes?: { CODECS?: string };
        }>>;
        SUBTITLES?: Record<string, Record<string, {
          uri?: string;
          language?: string;
          name?: string;
          forced?: string;
        }>>;
      };
      segments?: Array<{
        uri: string;
        duration: number;
        start?: number;
        byterange?: { offset: number; length: number };
        key?: {
          method: string;
          uri?: string;
          keyformat?: string;
        };
      }>;
      endList?: boolean;
    };
  }
}

declare module 'extpay' {
  interface ExtPayUser {
    paid: boolean;
    paidAt: Date | null;
    installedAt: Date | null;
    trialStartedAt: Date | null;
    email: string | null;
    subscriptionStatus: 'active' | 'past_due' | 'canceled' | null;
  }

  interface ExtPayInstance {
    startBackground(): void;
    getUser(): Promise<ExtPayUser>;
    openPaymentPage(): Promise<void>;
    openTrialPage(trialPeriod: string): Promise<void>;
    openLoginPage(): Promise<void>;
    onPaid: {
      addListener(callback: (user: ExtPayUser) => void): void;
    };
    onTrialStarted: {
      addListener(callback: (user: ExtPayUser) => void): void;
    };
  }

  function ExtPay(extensionId: string): ExtPayInstance;
  export default ExtPay;
}

declare module 'mpd-parser' {
  export function parse(manifestString: string, options?: { manifestUri?: string }): {
    duration?: number;
    minimumUpdatePeriod?: number;
    playlists?: Array<{
      uri?: string;
      attributes?: Record<string, any>;
      contentProtection?: Record<string, {
        pssh?: Uint8Array;
        'ms:laurl'?: { licenseUrl?: string };
      }>;
      segments?: Array<{
        uri?: string;
        duration?: number;
      }>;
    }>;
    mediaGroups?: {
      AUDIO?: Record<string, Record<string, {
        uri?: string;
        language?: string;
        name?: string;
      }>>;
      SUBTITLES?: Record<string, Record<string, {
        uri?: string;
        language?: string;
        name?: string;
        forced?: boolean;
      }>>;
    };
  };
}
