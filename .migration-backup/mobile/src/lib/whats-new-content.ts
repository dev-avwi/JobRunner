export interface WhatsNewItem {
  icon: string;
  title: string;
  description: string;
}

export interface WhatsNewRelease {
  version: string;
  headline: string;
  items: WhatsNewItem[];
}

export const WHATS_NEW_RELEASES: Record<string, WhatsNewRelease> = {
  '1.1.3': {
    version: '1.1.3',
    headline: "What's new in JobRunner",
    items: [
      {
        icon: 'star',
        title: 'Rate JobRunner',
        description:
          'After a paid invoice or a completed job, JobRunner now asks for a quick rating — your feedback helps us improve.',
      },
      {
        icon: 'navigation',
        title: 'Smarter "On My Way" SMS',
        description:
          'Live ETAs from your current location are included automatically so clients know exactly when to expect you.',
      },
      {
        icon: 'wifi-off',
        title: 'Better offline handling',
        description:
          'Photos, notes and time entries captured offline now sync more reliably with merge-aware conflict handling.',
      },
    ],
  },
};
