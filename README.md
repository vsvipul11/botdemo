# ultravox-demo-template-vercel
Template for creating Ultravox demo that gets deployed to Vercel.

This was bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Set-up
1. Add API key to .env.local
1. Configure settings in demo-config.ts

## Deployment
1. Clone
1. Vercel set env vars

## Query Params
| What | Parameter | Notes |
|--------|--------|---------|
|**Debug Logging**|`showDebugMessages=true`| Turns on some additional console logging.|
|**Speaker Mute Toggle**|`showSpeakerMute=true`| Shows the speaker mute button.|
|**Change Model**|`model=ultravox-70B`|Changes the model to what is specified. Note: the app will prepend `fixie-ai/` to the value.|
|**Enable User Transcripts**|`showUserTranscripts=true`|Displays user transcripts. Otherwise, only Ultravox/agent transcripts are shown.|
