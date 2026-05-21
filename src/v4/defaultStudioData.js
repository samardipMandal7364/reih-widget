/**
 * Demo defaults matching the provided studio HTML (URLs, labels, copy).
 */
export const DEFAULT_ORIGINAL_URL =
  'https://ireland.apollo.olxcdn.com/v1/files/eyJmbiI6Imhnc28wOWloODVqYzEtQVBMIiwidyI6W3siZm4iOiJlbnZmcXFlMWF5NGsxLUFQTCIsInMiOiIxNCIsInAiOiIxMCwtMTAiLCJhIjoiMCJ9XX0.xl3coq5Myw2ZZST61U0ZgdfNngD7VeQnLkp9v9pVtE4/image;s=1280x1024;q=80';

export const DEFAULT_STAGED_URL =
  'https://ai-team-test-2.s3.us-west-2.amazonaws.com/image+(2).webp';

export const DEFAULT_ROOMS = [
  {
    id: '0',
    label: 'Living room',
    originalUrl: DEFAULT_ORIGINAL_URL,
    stagedUrl: DEFAULT_STAGED_URL,
    thumbBg: 'rgb(92, 122, 140)',
  },
  {
    id: '1',
    label: 'Dining area',
    originalUrl:
      'https://ireland.apollo.olxcdn.com/v1/files/eyJmbiI6ImhoNTNwMmZnYjhnZjMtQVBMIiwidyI6W3siZm4iOiJlbnZmcXFlMWF5NGsxLUFQTCIsInMiOiIxNCIsInAiOiIxMCwtMTAiLCJhIjoiMCJ9XX0.FX_KuhZ0QzGEcj2kDcxqlrKZayxFFfq3Eu7DGkKpSYI/image;s=1280x1024;q=80',
    stagedUrl: 'https://ai-team-test-2.s3.us-west-2.amazonaws.com/image+(2).webp',
    thumbBg: 'rgb(124, 107, 94)',
  },
  {
    id: '2',
    label: 'Bedroom',
    originalUrl:
      'https://ireland.apollo.olxcdn.com/v1/files/eyJmbiI6InNoeTVlZWRsY25pbTEtQVBMIiwidyI6W3siZm4iOiJlbnZmcXFlMWF5NGsxLUFQTCIsInMiOiIxNCIsInAiOiIxMCwtMTAiLCJhIjoiMCJ9XX0.GN0BNp7S6LWj8kGpFfHroZAx9KyqbX8JWoxpt7FSuRo/image;s=1280x1024;q=80',
    stagedUrl: 'https://ai-team-test-2.s3.us-west-2.amazonaws.com/image+(2).webp',
    thumbBg: 'rgb(138, 122, 107)',
  },
  {
    id: '3',
    label: 'Kitchen',
    originalUrl:
      'https://ireland.apollo.olxcdn.com/v1/files/eyJmbiI6InVzYmVhcGtwanN6aDItQVBMIiwidyI6W3siZm4iOiJlbnZmcXFlMWF5NGsxLUFQTCIsInMiOiIxNCIsInAiOiIxMCwtMTAiLCJhIjoiMCJ9XX0.5gs2Lge4FDzEfc4cB0oXz-rEa6iJWq_1xjyI-x-BZus/image;s=1280x1024;q=80',
    stagedUrl: 'https://ai-team-test-2.s3.us-west-2.amazonaws.com/image+(2).webp',
    thumbBg: 'rgb(110, 122, 140)',
  },
  {
    id: '4',
    label: 'Study',
    originalUrl:
      'https://ireland.apollo.olxcdn.com/v1/files/eyJmbiI6ImRwbHZsMTRubTlwdy1BUEwiLCJ3IjpbeyJmbiI6ImVudmZxcWUxYXk0azEtQVBMIiwicyI6IjE0IiwicCI6IjEwLC0xMCIsImEiOiIwIn1dfQ.Ig_GwiYFVJiuPfFjYU5gNKgWHwzf6MhmP-kfQS0YmRg/image;s=1280x1024;q=80',
    stagedUrl: 'https://ai-team-test-2.s3.us-west-2.amazonaws.com/image+(2).webp',
    thumbBg: 'rgb(140, 112, 96)',
  },
];

export const DEFAULT_PILLS = [
  { text: 'Softer golden glow', disabled: true },
  { text: 'High-end hotel lounge', disabled: true },
  { text: 'Cozier movie night', disabled: true },
  { text: 'Cleaner designer edit', disabled: false },
];

export const DEFAULT_HISTORY = [
  {
    id: 'h1',
    label: 'Richer evening mood',
    sub: '3m ago',
    thumbUrl: 'https://ai-team-test-2.s3.us-west-2.amazonaws.com/image+(2).webp',
    active: true,
  },
  {
    id: 'h2',
    label: 'Warm modern lounge',
    sub: '3m ago',
    thumbUrl: 'https://ai-team-test-2.s3.us-west-2.amazonaws.com/image+(1).webp',
    active: false,
  },
];
