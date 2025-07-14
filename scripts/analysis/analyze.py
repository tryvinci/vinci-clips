import os
import sys
import json
from google import generativeai as genai
from groq import Groq

def analyze_transcript(transcript):
    """
    Analyzes the given transcript using either Gemini or Groq API
    to generate suggested clips.
    """
    llm_provider = os.environ.get("LLM_PROVIDER", "gemini")

    if llm_provider == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set.")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(f"models/{os.environ.get('LLM_MODEL', 'gemini-1.5-flash')}")
        response = model.generate_content(
            f"Analyze the following transcript and suggest up to 5 clips. Each clip should be a maximum of 60 seconds. Combine cuts if necessary. Respond with a JSON array of objects, where each object has 'start', 'end', and 'title' keys. Transcript: {transcript}",
            request_options={"timeout": 600},
        )
        return response.text
    elif llm_provider == "groq":
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable not set.")
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": f"Analyze the following transcript and suggest up to 5 clips. Each clip should be a maximum of 60 seconds. Combine cuts if necessary. Respond with a JSON array of objects, where each object has 'start', 'end', and 'title' keys. Transcript: {transcript}",
                }
            ],
            model="llama3-8b-8192",
        )
        return chat_completion.choices[0].message.content
    else:
        raise ValueError(f"Unsupported LLM provider: {llm_provider}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        transcript_text = sys.argv[1]
        try:
            analysis_result = analyze_transcript(transcript_text)
            print(analysis_result)
        except Exception as e:
            print(f"Error analyzing transcript: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Usage: python analyze.py \"<transcript_text>\"", file=sys.stderr)
        sys.exit(1) 