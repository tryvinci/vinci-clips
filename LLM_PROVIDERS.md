# OpenAI API Compatible LLM Support

Vinci Clips now supports multiple LLM providers through an OpenAI-compatible API interface. This allows you to use various AI services for video transcription and analysis.

## Supported Providers

### 1. Google Gemini (Default)
- **API Key**: `GEMINI_API_KEY`
- **Models**: `gemini-1.5-flash`, `gemini-2.5-flash`, etc.
- **Features**: Audio transcription + Text analysis
- **Cost**: Free tier available

### 2. OpenAI 
- **API Key**: `OPENAI_API_KEY`
- **Models**: `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo`, etc.
- **Features**: Text analysis only (transcription still requires Gemini)
- **Cost**: Pay per use

### 3. OpenAI-Compatible APIs
- **API Key**: `LLM_API_KEY`
- **Base URL**: `LLM_BASE_URL`
- **Examples**: Perplexity, local APIs, gpt4free proxies
- **Features**: Text analysis only
- **Cost**: Varies by provider

## Configuration

### Environment Variables

Add these to your `backend/.env` file:

```env
# Primary LLM Provider
LLM_PROVIDER=gemini  # or 'openai'

# Gemini Configuration (recommended for full functionality)
GEMINI_API_KEY=your_gemini_api_key_here
LLM_MODEL=gemini-1.5-flash

# OR OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
LLM_MODEL=gpt-3.5-turbo

# OR Custom OpenAI-Compatible API
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.example.com/v1
LLM_MODEL=custom-model-name
```

### Provider Selection Logic

1. **Primary Provider**: Set by `LLM_PROVIDER` environment variable
2. **Automatic Fallback**: If primary provider fails, automatically tries available alternatives
3. **Provider Detection**: Automatically detects which providers are configured based on available API keys

## Usage Examples

### Using Gemini (Recommended)
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza...your_key
LLM_MODEL=gemini-1.5-flash
```

### Using OpenAI
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...your_key
LLM_MODEL=gpt-3.5-turbo
```

### Using Perplexity AI
```env
LLM_PROVIDER=openai
LLM_API_KEY=pplx-...your_key
LLM_BASE_URL=https://api.perplexity.ai
LLM_MODEL=llama-3.1-sonar-small-128k-online
```

### Using Local/Custom API
```env
LLM_PROVIDER=openai
LLM_API_KEY=your_local_key
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=local-model
```

## API Endpoints

### Check Provider Status
```bash
curl http://localhost:8080/clips/llm/provider-info
```

Response:
```json
{
  "status": "success",
  "data": {
    "provider": "gemini",
    "available": ["gemini", "openai"],
    "model": "gemini-1.5-flash"
  }
}
```

## Important Notes

### Audio Transcription Limitation
- **Audio transcription currently only works with Gemini** due to its file upload API
- OpenAI Whisper integration is planned for future releases
- For now, you can use OpenAI for analysis while keeping Gemini for transcription

### Fallback Behavior
- If your primary provider fails, the system automatically tries other configured providers
- This ensures high availability even if one service is down

### Cost Optimization
- **Gemini**: Free tier with generous limits, best for getting started
- **OpenAI**: Pay-per-use, higher quality but more expensive
- **Alternatives**: Often cheaper or free options available

## Getting API Keys

### Google Gemini (Free)
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API key"
3. Copy the key to your `.env` file

### OpenAI (Paid)
1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Create new secret key
3. Copy the key to your `.env` file

### Perplexity AI (Paid)
1. Visit [Perplexity API](https://www.perplexity.ai/settings/api)
2. Generate API key
3. Set `LLM_BASE_URL=https://api.perplexity.ai`

## Troubleshooting

### "No LLM provider configured"
- Ensure you have set at least one of: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `LLM_API_KEY`
- Check that your API keys are valid and not expired

### Provider Info Shows Empty Available Array
- This means no valid API keys were detected
- Verify your environment variables are loaded correctly
- Check API key format and validity

### Analysis Works But Transcription Fails
- This is expected when using only OpenAI/custom providers
- Keep `GEMINI_API_KEY` for transcription functionality
- The system will use Gemini for transcription and your chosen provider for analysis

## Migration Guide

### From Gemini-Only Setup
Your existing setup will continue working without changes. To add OpenAI:

```env
# Keep existing Gemini configuration
GEMINI_API_KEY=your_existing_key

# Add OpenAI as secondary provider
OPENAI_API_KEY=your_openai_key

# Optional: Switch primary provider
LLM_PROVIDER=openai
```

### For New Installations
Choose your preferred configuration:

**Option 1: Gemini Only (Recommended for beginners)**
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key
LLM_MODEL=gemini-1.5-flash
```

**Option 2: Hybrid Setup (Best of both worlds)**
```env
LLM_PROVIDER=openai
GEMINI_API_KEY=your_gemini_key    # For transcription
OPENAI_API_KEY=your_openai_key    # For analysis  
LLM_MODEL=gpt-3.5-turbo
```

This setup gives you free transcription with Gemini and high-quality analysis with OpenAI.