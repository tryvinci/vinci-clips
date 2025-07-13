# Product Requirements Document: Clips (GCP, Next.js, Gemini API)

## 1. Introduction

The Clips is an AI-powered video clipping tool designed to transform long-form videos into short, engaging clips optimized for social media platforms such as TikTok, Instagram Reels, YouTube Shorts, and others. By leveraging Google Cloud Platform (GCP), a REST API server, Next.js, Whisper, MongoDB, and Google’s Gemini API (Flash 2.0), the tool automates video analysis, clipping, and enhancement, streamlining content creation for creators, marketers, and podcasters. This PRD details the technical requirements for building the tool from scratch, incorporating Clips’ core and advanced features while addressing user feedback for improved functionality.

### Purpose
The Clips aims to provide an accessible, scalable solution for repurposing long videos into viral-ready shorts, enhancing user productivity and content reach. It will offer a seamless experience through a Next.js frontend, robust backend processing on GCP, and AI-driven analysis via Gemini Flash 2.0.

### Target Audience
- **Content Creators**: Vloggers, educators, and influencers seeking short-form content.
- **Social Media Managers**: Professionals managing brand presence on social platforms.
- **Marketers**: Teams creating promotional videos for campaigns.
- **Podcasters**: Audio and video podcasters sharing engaging snippets.
- **Video Editors**: Professionals automating editing tasks.

## 2. Features

The following sections outline the features, user stories, functional requirements, and technical implementation details, categorized into core (essential) and advanced (enhancing competitiveness) features.

### 2.1 Video Upload and Processing
- **User Story**: As a user, I want to upload my long-form video so the system can process it and generate short clips.
- **Functional Requirements**:
  - Support video formats: MP4, MOV, AVI (up to 2GB).
  - Provide upload progress and file validation feedback.
  - Store videos securely with access restricted to authenticated users.
- **Technical Implementation**:
  - **Frontend**: Next.js component with a file upload interface using `react-dropzone`.
  - **Backend**: REST API server (Node.js with Express) to handle uploads, deployed on GCP Cloud Run.
  - **Storage**: GCP Cloud Storage for video files, with bucket policies for security.
  - **Validation**: Use `file-type` library to verify video formats and integrity.

### 2.2 Speech Recognition and Transcription
- **User Story**: As a user, I want accurate transcription of my video’s audio with timestamps to identify clip-worthy moments.
- **Functional Requirements**:
  - Achieve >97% transcription accuracy with SRT timestamp output.
  - Support 20+ languages (e.g., English, Spanish, Mandarin).
  - Allow users to edit transcripts for minor corrections.
- **Technical Implementation**:
  - **Transcription**: Use OpenAI Whisper (`base` or `large` model) via Python, hosted on GCP Compute Engine or Cloud Run for processing.
  - **Storage**: Save transcripts in MongoDB with fields for video ID, timestamps, and text.
  - **Editing**: Next.js interface with a text editor for transcript corrections, updating MongoDB via API.

### 2.3 AI-Based Clipping
- **User Story**: As a user, I want the system to automatically select engaging video segments for short clips.
- **Functional Requirements**:
  - Identify 5–10 engaging moments per video using AI analysis.
  - Support genre-specific clipping (e.g., podcasts, vlogs).
  - Allow manual adjustment of selected segments.
- **Technical Implementation**:
  - **AI Analysis**: Use Google Gemini API (Flash 2.0) for transcript analysis. Example prompt: “Analyze the transcript and select the top 5 engaging moments, returning indices (e.g., 1,3,5,7,9).”
  - **API Integration**: REST API endpoint to send transcript data to Gemini API, parsing JSON responses for segment indices.
  - **Manual Adjustments**: UI in Next.js for users to modify start/end times, stored in MongoDB.

### 2.4 Video Clipping
- **User Story**: As a user, I want downloadable short video clips based on AI-selected segments.
- **Functional Requirements**:
  - Generate MP4 clips at 1080p (default), with options for 720p or 4K.
  - Ensure smooth, coherent clip transitions.
  - Provide bulk download options.
- **Technical Implementation**:
  - **Clipping**: Use FFmpeg (`ffmpeg-python`) on GCP Cloud Run to cut videos (e.g., `ffmpeg -i input.mp4 -ss start_time -to end_time -c copy output.mp4`).
  - **Queue Management**: Implement Cloud Tasks for parallel clip processing.
  - **Storage**: Store clips in GCP Cloud Storage, with download links served via API.

### 2.5 User Interface
- **User Story**: As a user, I want an intuitive web interface to manage videos and clips.
- **Functional Requirements**:
  - Support user authentication (login, signup).
  - Provide a dashboard for video uploads, processing status, and clip previews.
  - Enable clip downloads and previews with playback controls.
- **Technical Implementation**:
  - **Frontend**: Next.js with Tailwind CSS for a responsive UI, hosted on GCP App Engine or Vercel.
  - **Backend**: REST API (Express) for user management and video processing, integrated with Firebase Authentication.
  - **Database**: MongoDB for user data, video metadata, and clip references.
  - **Video Player**: Use Video.js for clip previews in the Next.js app.

### 2.6 Auto-Reframing
- **User Story**: As a user, I want clips adjusted for social media aspect ratios (e.g., 9:16, 1:1).
- **Functional Requirements**:
  - Support TikTok (9:16), Instagram (1:1), YouTube (16:9).
  - Automatically center subjects using AI detection.
  - Allow manual reframing adjustments.
- **Technical Implementation**:
  - **Subject Detection**: Use MediaPipe (Google’s AI toolkit) for face/object detection, hosted on GCP.
  - **Reframing**: FFmpeg to crop/resize videos based on detection coordinates.
  - **UI**: Next.js component for drag-and-drop reframing adjustments.

### 2.7 AI-Generated B-roll
- **User Story**: As a user, I want relevant B-roll added to enhance clip engagement.
- **Functional Requirements**:
  - Automatically select B-roll based on video context.
  - Support user-selected categories (e.g., nature, tech).
- **Technical Implementation**:
  - **B-roll Source**: Integrate Pexels API for free stock footage.
  - **Matching**: Use Gemini Flash 2.0 to match B-roll to transcript keywords.
  - **Insertion**: FFmpeg to overlay or intersperse B-roll in clips.

### 2.8 Captioning
- **User Story**: As a user, I want stylized captions added to my clips for accessibility and engagement.
- **Functional Requirements**:
  - Generate synchronized captions from transcription.
  - Offer customizable styles (font, color, position).
  - Support burning captions into videos or exporting as SRT.
- **Technical Implementation**:
  - **Caption Generation**: Use Whisper’s SRT output.
  - **Styling**: Next.js editor for caption customization, stored in MongoDB.
  - **Rendering**: FFmpeg to burn captions or export SRT files.

### 2.9 Social Media Integration
- **User Story**: As a user, I want to schedule and post clips to social media platforms.
- **Functional Requirements**:
  - Integrate with YouTube, TikTok, Instagram, Facebook, LinkedIn, and X.
  - Provide a scheduling calendar.
  - Generate AI-driven captions and hashtags.
- **Technical Implementation**:
  - **APIs**: Use platform-specific APIs (e.g., YouTube Data API, TikTok API) via REST calls.
  - **Authentication**: Firebase Authentication for OAuth flows.
  - **AI Text**: Gemini Flash 2.0 for generating captions/hashtags.

### 2.10 Virality Score
- **User Story**: As a user, I want a score indicating my clips’ social media potential.
- **Functional Requirements**:
  - Assign a 0–100 score based on content analysis.
  - Consider keywords, sentiment, and trends.
- **Technical Implementation**:
  - **Algorithm**: Use Gemini API to analyze transcript sentiment and keywords, combined with heuristic scoring.
  - **Display**: Show scores in Next.js dashboard alongside clips.

### 2.11 Team Collaboration
- **User Story**: As a team member, I want to collaborate on video projects.
- **Functional Requirements**:
  - Support user roles (admin, editor).
  - Enable shared projects and folders.
  - Manage processing credits.
- **Technical Implementation**:
  - **RBAC**: Implement role-based access in MongoDB and API.
  - **Interface**: Next.js workspace for team project management.

### 2.12 Export Options
- **User Story**: As a user, I want to export clips in various formats.
- **Functional Requirements**:
  - Support MP4, AVI, 720p, 1080p, 4K.
  - Export XML for Adobe Premiere Pro.
- **Technical Implementation**:
  - **Transcoding**: FFmpeg for format conversion.
  - **Project Files**: Generate XML via Python scripts.

### 2.13 API Access
- **User Story**: As a developer, I want to integrate clipping functionality into my apps.
- **Functional Requirements**:
  - Provide RESTful API for video upload, processing, and clip retrieval.
  - Include documentation and authentication.
- **Technical Implementation**:
  - **API**: Expose endpoints (e.g., `/clips/upload`, `/clips/clips`) on Cloud Run.
  - **Authentication**: API keys via Firebase.
  - **Docs**: Use Swagger for API documentation.

### 2.14 Talking Baby Effect
- **User Story**: As a user, I want a baby-face effect for podcast clips.
- **Functional Requirements**:
  - Apply AI-driven baby-face effect with voice pitch adjustment.
  - Add captions, B-roll, and emojis.
- **Technical Implementation**:
  - **Face Effect**: Use DeepFaceLab or similar on GCP.
  - **Voice**: `pydub` for pitch adjustment.
  - **Enhancements**: Integrate captions and B-roll.

### 2.15 Mid-Form Video Generation
- **User Story**: As a user, I want longer clips (up to 15 minutes).
- **Functional Requirements**:
  - Generate 30-second to 15-minute clips.
  - Support various content types.
- **Technical Implementation**:
  - **Clipping**: Adjust FFmpeg for longer durations.
  - **AI**: Modify Gemini prompts for longer segments.

## 3. Non-Functional Requirements

- **Performance**: Process hour-long videos within 10 minutes using GCP’s parallel processing.
- **Scalability**: Handle 100+ concurrent users via Cloud Run and Cloud Storage.
- **Security**: Use Firebase Authentication, GCP IAM, and encryption for data protection.
- **Usability**: Ensure responsive Next.js UI for desktop and mobile.
- **Reliability**: Achieve >99.9% uptime with GCP’s managed services.

## 4. Technical Architecture

| Component          | Description                                                                 |
|--------------------|-----------------------------------------------------------------------------|
| **Frontend**       | Next.js with Tailwind CSS, hosted on GCP App Engine or Vercel.              |
| **Backend**        | Node.js (Express) REST API on Cloud Run for processing and management.       |
| **Processing**     | Cloud Tasks for transcription, AI analysis, and clipping.                    |
| **Database**       | MongoDB (Atlas on GCP) for user data, video metadata, and transcripts.       |
| **Storage**        | GCP Cloud Storage for videos and clips.                                     |
| **AI Services**    | Whisper for transcription, Gemini Flash 2.0 for analysis.                    |
| **Third-Party APIs**| Social media APIs, Pexels for B-roll.                                       |

## 5. Dependencies

| Dependency         | Purpose                              | Source                                      |
|--------------------|--------------------------------------|---------------------------------------------|
| Whisper            | Transcription                        | OpenAI (Python package)                     |
| FFmpeg             | Video/audio processing               | FFmpeg.org                                  |
| Next.js            | Frontend development                 | Nextjs.org                                  |
| MongoDB Atlas      | Database                             | mongodb.com                                 |
| Gemini API         | LLM for analysis and text generation | cloud.google.com/gemini                     |
| Cloud Storage      | Video/clip storage                   | cloud.google.com/storage                    |
| MediaPipe          | Subject detection for reframing      | mediapipe.dev                               |

## 6. Workflow
1. **Analyze**: Transcribe video with Whisper and analyze with Gemini Flash 2.0.
2. **Curate**: Select viral segments using Gemini’s multimodal capabilities.
3. **Edit**: Enhance clips with captions, B-roll, and transitions via FFmpeg.
4. **Share**: Post or schedule clips to social media platforms.

## 7. Limitations and Mitigations
| Limitation                     | Mitigation                                                                 |
|--------------------------------|---------------------------------------------------------------------------|
| Incomplete clips               | Improve Gemini prompt engineering and manual editing tools.                |
| Gemini API costs               | Optimize API calls and explore free tiers or caching.                      |
| Transcription errors           | Allow user corrections via Next.js interface.                             |
| Scalability with large videos  | Use GCP Cloud Run auto-scaling and Cloud Tasks for efficient processing.   |

## 8. Example Code Snippet
Below is a sample REST API endpoint for processing videos, integrating Whisper and Gemini.

```javascript
// server.js (Node.js/Express)
const express = require('express');
const { Storage } = require('@google-cloud/storage');
const ffmpeg = require('fluent-ffmpeg');
const { MongoClient } = require('mongodb');
const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');

const app = express();
const storage = new Storage();
const bucket = storage.bucket('clips-videos');
const client = new MongoClient('mongodb://<gcp-mongodb-uri>');

app.post('/clips/process-video', async (req, res) => {
  const { videoPath, userId } = req.body;
  try {
    // Transcribe with Whisper (assumes Python script integration)
    const transcript = await runWhisper(videoPath); // Custom function to call Whisper
    await client.connect();
    const db = client.db('clips');
    await db.collection('transcripts').insertOne({ userId, videoPath, transcript });

    // Analyze with Gemini Flash 2.0
    const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    const accessToken = await auth.getAccessToken();
    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `Analyze: ${transcript}` }] }] })
    });
    const selectedIndices = (await geminiResponse.json()).candidates[0].content.parts[0].text.split(',');

    // Clip video
    const clips = [];
    for (const idx of selectedIndices) {
      const { start, end } = transcript.segments[idx];
      const outputPath = `clip_${idx}.mp4`;
      await new Promise((resolve) => {
        ffmpeg(videoPath)
          .setStartTime(start)
          .setDuration(end - start)
          .output(outputPath)
          .on('end', resolve)
          .run();
      });
      await bucket.upload(outputPath, { destination: `clips/${userId}/${outputPath}` });
      clips.push(outputPath);
    }

    res.json({ clips });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(8080, () => console.log('Server running on port 8080'));
```

## 9. Conclusion
The Clips leverages GCP, Next.js, Whisper, MongoDB, and Gemini Flash 2.0 to deliver a scalable, user-friendly video clipping tool. By addressing its limitations and incorporating advanced features like auto-reframing and social media integration, it aims to empower content creators as of July 11, 2025.

## Citations
- [Google Gemini API](https://cloud.google.com/gemini)
- [GCP Cloud Storage](https://cloud.google.com/storage)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Next.js Documentation](https://nextjs.org/docs)