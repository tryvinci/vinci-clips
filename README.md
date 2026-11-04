# Vinci Clips

Turn a long video into short vertical clips with captions. Self-hosted, open source (AGPL-3.0), runs on your machine with one Gemini API key.

<!-- DEMO GIF PLACEHOLDER: docs/assets/clips-demo.gif
Should show, in about 20 seconds: drag a 10+ minute podcast MP4 into the upload page, the transcript appearing with speaker labels, clicking "Analyze" and the suggested clips list, generating one clip, opening the reframe modal (9:16 crop around a face), picking the "Neon Pop" caption style, and playing the finished vertical clip. Keep it under 8 MB. -->

If this saves you an Opus Clip subscription, please [star the repo](https://github.com/tryvinci/vinci-clips). It is the main way other people find it.

## Quick start

```bash
git clone https://github.com/tryvinci/vinci-clips && cd vinci-clips && npm run install:all && cp backend/.env.example backend/.env && cp frontend/env.example frontend/.env.local && npm start
```

Then put your key in `backend/.env` (`GEMINI_API_KEY=...`) and open http://localhost:3000.

You need Node.js 18+ and FFmpeg on your PATH. A free Gemini API key works: https://aistudio.google.com/apikey

## What it does

- **Upload or import.** Drag and drop a video up to 2 GB, or paste a YouTube URL.
- **Transcribe.** FFmpeg pulls the audio, Gemini returns word-level timestamps with speaker labels. Model is set by `LLM_MODEL` (default `gemini-2.5-flash` in `.env.example`).
- **Find the clips.** Gemini reads the transcript and suggests segments worth posting.
- **Cut them.** FFmpeg renders the suggested clips to `backend/uploads/clips`.
- **Reframe to 9:16.** Face detection (face-api.js) picks a vertical crop window around the speaker.
- **Burn captions.** Five caption styles: Bold Center, Neon Pop, Typewriter, Bubble Style, Minimal Clean. Rendered through SRT and FFmpeg.
- **Streamer layout.** Split a gameplay recording with a webcam into a stacked vertical reel.
- **Local storage.** Transcripts live in `backend/storage/db.json`, videos in `backend/uploads`. No database to run.

## How it works

```
Next.js frontend (3000)  ->  Express API (8080)  ->  FFmpeg + Gemini API
                                   |
                     backend/storage/db.json, backend/uploads/
```

| Path | What is there |
| --- | --- |
| `backend/src/routes/` | upload, import, transcripts, analyze, clips, reframe, captions, streamer |
| `backend/src/localdb.js` | JSON file store used by the `Transcript` model |
| `frontend/src/app/` | upload page, transcript list, transcript detail |
| `frontend/src/components/` | ReframeModal, CaptionGenerator, StreamerGameplayCrop, SubjectDetection |

## Configuration

| Variable | File | Default | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | `backend/.env` | none | Required |
| `LLM_MODEL` | `backend/.env` | `gemini-2.5-flash` | Any Gemini model with audio input |
| `PORT` | `backend/.env` | `8080` | Backend port |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | `http://localhost:8080` | Where the frontend finds the API |

Docker: `docker-compose up --build`. See `docker-setup.md`.

## Privacy and cost

Your video files stay on your disk. The extracted audio and transcript text are sent to the Gemini API for transcription and clip selection, so Google's API terms apply to that data. Cost is whatever Gemini charges for those calls. There is no Vinci account.

## Related: Vinci

Want to generate video, not just cut it? [Vinci](https://github.com/tryvinci/vinci) is our MIT-licensed studio that runs image, video, voice, and lipsync models from many providers in one local app, with a price shown before each job. It also has a podcast-to-shorts workflow. If that sounds useful, give it a star too.

## Contributing

Issues labeled `good first issue` are a good place to start. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

AGPL-3.0. If you run a modified version as a service, you must publish your changes. For other licensing, email support@tryvinci.com.

---

If Vinci Clips is useful to you, a [star](https://github.com/tryvinci/vinci-clips) helps a lot.
