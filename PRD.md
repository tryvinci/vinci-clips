# 1. Overview

Vinci Clips is an AI-powered video clipping platform that automatically generates short, engaging video clips from longer videos with advanced features for social media optimization. The platform supports video uploads, URL imports from major platforms, AI-driven clip analysis, auto-reframing for different aspect ratios, AI-generated B-roll, captioning, and direct social media publishing.

# 2. High-Level Architecture

The application is built with a modern, full-stack architecture:

-   **Frontend:** A Next.js application built with React, TypeScript, and Tailwind CSS.
-   **Backend:** A Node.js server built with Express with modular route handlers.
-   **Database:** MongoDB with Mongoose ODM for data persistence.
-   **AI Services:** Google's Gemini API for transcription and analysis, with additional AI services for content generation.
-   **Cloud Storage:** Google Cloud Storage for video, audio, and generated content storage.
-   **Video Processing:** FFmpeg for video manipulation, conversion, and enhancement.

## 2.1. Core Workflow

1.  **Input:** Users can upload video files (up to 2GB) or import videos via URLs from YouTube, Instagram, LinkedIn, Vimeo, etc.
2.  **Processing:** The backend converts videos to MP3 and generates thumbnails using FFmpeg.
3.  **Cloud Storage:** Videos, audio files, and thumbnails are uploaded to Google Cloud Storage in parallel.
4.  **Transcription:** The Gemini API transcribes audio with speaker diarization and timestamp accuracy.
5.  **Analysis:** AI analyzes transcripts to suggest 3-5 optimal clips with single or multi-segment options.
6.  **Enhancement:** Advanced features include auto-reframing, AI B-roll generation, and captioning.
7.  **Database:** All data including status tracking, clips, and metadata is stored in MongoDB.
8.  **Publishing:** Generated clips can be scheduled and posted directly to social media platforms.

## 2.2. Video Input Sources

### File Upload
- Direct file upload with drag-and-drop interface
- Support for MP4, MOV, AVI formats up to 2GB
- Real-time upload progress with status tracking

### URL Import
- **YouTube:** Extract videos using YouTube Data API v3
- **Instagram:** Import public posts and reels
- **LinkedIn:** Import video posts from profiles/pages
- **Vimeo:** Support for public and authenticated video imports
- **Facebook:** Import public video content
- **TikTok:** Import public videos (where permitted)

## 2.3. Advanced Content Features

### Auto-Reframing
- **Aspect Ratio Support:** 9:16 (TikTok/Shorts), 1:1 (Instagram), 16:9 (YouTube)
- **AI Subject Detection:** Automatic centering using MediaPipe
- **Manual Adjustment:** User-controlled reframing with drag-and-drop interface

### AI-Generated B-roll
- **Context-Aware Generation:** Select B-roll based on video content analysis
- **Category Selection:** User-defined B-roll categories and themes
- **Seamless Integration:** Automatic timing and placement within clips

### Captioning System
- **Auto-Generated Captions:** Synchronized captions from transcription data
- **Style Customization:** Multiple caption styles, fonts, and animations
- **Export Options:** Burn-in captions or export SRT files
- **Multi-Language Support:** Caption translation capabilities

### Social Media Integration
- **Platform Support:** YouTube, TikTok, Instagram, Facebook, LinkedIn, X (Twitter)
- **Scheduling Calendar:** Content calendar with optimal posting times
- **AI-Generated Metadata:** Automatic captions, hashtags, and descriptions
- **Cross-Platform Optimization:** Format-specific optimizations per platform

# 3. Detailed Feature Specifications

## 3.1. Auto-Reframing Implementation

### User Story
As a user, I want clips adjusted for social media aspect ratios (e.g., 9:16, 1:1) with automatic subject detection.

### Functional Requirements
- Support TikTok (9:16), Instagram (1:1), YouTube (16:9) aspect ratios
- Automatically center subjects using AI detection
- Allow manual adjustments with intuitive drag-and-drop interface
- Preview reframed clips before generation

### Technical Implementation
- **Backend:** `/api/reframe` endpoint using FFmpeg and MediaPipe for subject detection
- **Frontend:** Next.js component for drag-and-drop reframing interface
- **Processing:** Reuse existing video processing pipeline for optimized performance

## 3.2. AI-Generated B-roll

### User Story
As a user, I want relevant B-roll automatically added to enhance clip engagement and visual appeal.

### Functional Requirements
- Generate B-roll based on video context and transcript analysis
- Support user-selected categories and themes
- Seamless integration with existing clip timeline
- Preview B-roll options before applying

### Technical Implementation
- **Backend:** Integration with AI video generation APIs for B-roll creation
- **Context Analysis:** Use Gemini API for content understanding and B-roll matching
- **Frontend:** Next.js UI for category selection and B-roll preview

## 3.3. Advanced Captioning System

### User Story
As a user, I want stylized captions automatically added to my clips with customization options.

### Functional Requirements
- Generate synchronized captions from existing transcription data
- Offer multiple customizable caption styles and animations
- Support burning captions into video or exporting SRT files
- Multi-language caption support and translation

### Technical Implementation
- **Backend:** `/api/add-captions` endpoint using FFmpeg for caption burning
- **Caption Generation:** Leverage existing transcript data with timing synchronization
- **Frontend:** Next.js editor for caption style customization and preview

## 3.4. Social Media Integration

### User Story
As a user, I want to schedule and post clips directly to social media platforms with AI-generated captions and hashtags.

### Functional Requirements
- Integration with YouTube, TikTok, Instagram, Facebook, LinkedIn, X (Twitter)
- Content scheduling calendar with optimal posting time suggestions
- AI-generated captions, hashtags, and descriptions
- Platform-specific format optimizations

### Technical Implementation
- **Backend:** `/api/social-post` endpoint with platform-specific API integrations
- **AI Content:** Use Gemini API for caption and hashtag generation
- **Frontend:** Next.js calendar component for scheduling and content management

## 3.5. Video URL Import System

### User Story
As a user, I want to import videos from YouTube, Instagram, LinkedIn, Vimeo, and other platforms using just their URLs.

### Functional Requirements
- Support major video platforms: YouTube, Instagram, LinkedIn, Vimeo, Facebook, TikTok
- Automatic video download and processing integration
- Metadata extraction (title, description, duration)
- Quality selection for optimal processing

### Technical Implementation
- **Backend:** `/api/import-url` endpoint with platform-specific extractors
- **Video Processing:** Integration with existing upload and processing pipeline
- **Frontend:** URL input interface with platform detection and preview

# 4. Non-Functional Requirements

-   **Scalability:** Handle concurrent users and multiple video processing jobs with background queue system
-   **Reliability:** High availability with robust error handling and automatic retry mechanisms
-   **Security:** Secure handling of user data, API keys, and social media authentication
-   **Performance:** Optimized video processing with progress tracking and efficient cloud storage
-   **Compliance:** Adhere to platform-specific terms of service and content policies