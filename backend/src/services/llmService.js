const { GoogleGenerativeAI, GoogleAIFileManager, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const OpenAI = require('openai');

class LLMService {
    constructor() {
        this.provider = process.env.LLM_PROVIDER || 'gemini';
        this.initializeProviders();
    }

    initializeProviders() {
        // Initialize Gemini (default/fallback)
        if (process.env.GEMINI_API_KEY) {
            this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.geminiFileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
        }

        // Initialize OpenAI-compatible clients
        if (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) {
            const config = {
                apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY,
            };

            // Support custom base URL for OpenAI-compatible APIs
            if (process.env.LLM_BASE_URL) {
                config.baseURL = process.env.LLM_BASE_URL;
            }

            this.openaiClient = new OpenAI(config);
        }
    }

    async analyzeTranscript(transcriptText, videoDuration, maxTimeFormatted) {
        const prompt = `Given the following transcript, propose 3-5 video clips that would make engaging short content. The video is ${Math.floor(videoDuration / 60)}:${String(Math.floor(videoDuration % 60)).padStart(2, '0')} long.

CRITICAL CONSTRAINTS:
- Video duration is EXACTLY ${maxTimeFormatted} - DO NOT suggest any timestamps beyond this
- Each clip should be 30-90 seconds total duration
- All timestamps must be in MM:SS format and within 0:00 to ${maxTimeFormatted}

You can suggest two types of clips:

1. SINGLE SEGMENT clips: One continuous segment from start time to end time
2. MULTI-SEGMENT clips: Multiple segments that when combined tell a coherent story

For single segments: provide 'start' and 'end' times in MM:SS format.
For multi-segments: provide an array of segments in 'segments' field, each with 'start' and 'end' times.

VALIDATION RULES:
- Every timestamp must be ≤ ${maxTimeFormatted}
- Total duration must be 30-90 seconds
- Focus on complete thoughts or exchanges
- Ensure segments make sense when combined

Output format: JSON array where each object has:
- 'title': descriptive title
- For single segments: 'start' and 'end' fields  
- For multi-segments: 'segments' array with objects containing 'start' and 'end'

Transcript: ${transcriptText}`;

        try {
            if (this.provider === 'openai' && this.openaiClient) {
                return await this.analyzeWithOpenAI(prompt);
            } else if (this.provider === 'gemini' && this.geminiClient) {
                return await this.analyzeWithGemini(prompt);
            } else {
                // Fallback to available provider
                if (this.geminiClient) {
                    return await this.analyzeWithGemini(prompt);
                } else if (this.openaiClient) {
                    return await this.analyzeWithOpenAI(prompt);
                } else {
                    throw new Error('No LLM provider configured. Please set GEMINI_API_KEY or OPENAI_API_KEY/LLM_API_KEY');
                }
            }
        } catch (error) {
            console.error(`LLM analysis failed with ${this.provider}:`, error);
            // Try fallback if primary fails
            if (this.provider === 'openai' && this.geminiClient) {
                console.log('Falling back to Gemini...');
                return await this.analyzeWithGemini(prompt);
            } else if (this.provider === 'gemini' && this.openaiClient) {
                console.log('Falling back to OpenAI...');
                return await this.analyzeWithOpenAI(prompt);
            }
            throw error;
        }
    }

    async analyzeWithGemini(prompt) {
        const model = this.geminiClient.getGenerativeModel({
            model: process.env.LLM_MODEL || 'gemini-1.5-flash',
        });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: prompt }],
            }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            title: { type: 'STRING' },
                            start: { type: 'STRING' },
                            end: { type: 'STRING' },
                            segments: {
                                type: 'ARRAY',
                                items: {
                                    type: 'OBJECT',
                                    properties: {
                                        start: { type: 'STRING' },
                                        end: { type: 'STRING' },
                                    },
                                    required: ['start', 'end'],
                                },
                            },
                        },
                        required: ['title'],
                        propertyOrdering: ['title', 'start', 'end', 'segments'],
                    },
                },
            },
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ],
        });

        const response = await result.response;
        return JSON.parse(response.text());
    }

    async analyzeWithOpenAI(prompt) {
        const response = await this.openaiClient.chat.completions.create({
            model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a video editing assistant that analyzes transcripts and suggests engaging clips. Always respond with valid JSON only.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);
        
        // OpenAI might return an object with clips array, normalize to array
        return Array.isArray(parsed) ? parsed : (parsed.clips || []);
    }

    async transcribeAudio(audioFilePath, originalFilename) {
        // Note: Audio transcription is more complex as it requires file handling
        // For now, this will only work with Gemini due to its file upload API
        // OpenAI Whisper requires different handling and is typically used for pure transcription
        
        if (!this.geminiClient) {
            throw new Error('Audio transcription currently requires Gemini API. Please set GEMINI_API_KEY.');
        }

        return await this.transcribeWithGemini(audioFilePath, originalFilename);
    }

    async transcribeWithGemini(audioFilePath, originalFilename) {
        // Upload the audio file to Gemini File API
        const uploadResult = await this.geminiFileManager.uploadFile(audioFilePath, {
            mimeType: 'audio/mpeg',
            displayName: originalFilename || 'audio.mp3'
        });

        const model = this.geminiClient.getGenerativeModel({
            model: process.env.LLM_MODEL || 'gemini-1.5-flash',
        });
        
        const audioPart = { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } };

        const prompt = "Transcribe the provided audio with word-level timestamps and identify the speaker for each word. Format the output as a JSON array of objects, where each object represents a single word with precise millisecond timing. Each object should have 'start' (in format MM:SS:mmm), 'end' (in format MM:SS:mmm), 'text' (single word), and 'speaker' fields. For example: [{'start': '00:00:000', 'end': '00:00:450', 'text': 'Hello', 'speaker': 'Speaker 1'}, {'start': '00:00:450', 'end': '00:00:890', 'text': 'world', 'speaker': 'Speaker 1'}]";

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    audioPart,
                ],
            }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            start: { type: 'STRING' },
                            end: { type: 'STRING' },
                            text: { type: 'STRING' },
                            speaker: { type: 'STRING' },
                        },
                        required: ['start', 'end', 'text', 'speaker'],
                        propertyOrdering: ['start', 'end', 'text', 'speaker'],
                    },
                },
            },
        });

        const response = await result.response;
        return JSON.parse(response.text());
    }

    // Helper method to check which providers are available
    getAvailableProviders() {
        const providers = [];
        if (this.geminiClient) providers.push('gemini');
        if (this.openaiClient) providers.push('openai');
        return providers;
    }

    // Get current provider info
    getProviderInfo() {
        return {
            provider: this.provider,
            available: this.getAvailableProviders(),
            model: process.env.LLM_MODEL || (this.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-3.5-turbo')
        };
    }
}

// Export singleton instance
module.exports = new LLMService();