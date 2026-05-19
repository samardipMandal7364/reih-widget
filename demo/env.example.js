/**
 * Local environment config for the restyle demo.
 * Copy this file to env.js and fill in real values.
 * env.js is gitignored — never commit real tokens.
 *
 * Dev URLs (matches reimaginehome-2.0-frontend tenant config).
 */
window.__REIH_ENV__ = {
  clientId: 'YOUR_COGNITO_CLIENT_ID',
  bearerToken: 'YOUR_COGNITO_ID_TOKEN',
  mediaId: 'YOUR_MEDIA_ID',
  apiBaseUrl: 'https://dev-api.reimaginehome.ai/v3',
  apiBaseUrlV2: 'https://dev-api.reimaginehome.ai/v2',
  wsBaseUrl: 'wss://bcbss17qsc.execute-api.us-west-2.amazonaws.com/dev',
  apiVersion: 'v2',
  solutionName: 'REDESIGN_FURNISHED_ROOM',
  designTheme: 'Modern',
  designingFor: 'Homeowners',
};
