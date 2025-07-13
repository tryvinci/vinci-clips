import sys
import json
from google.cloud import speech

def transcribe_gcs_with_timestamps(gcs_uri: str) -> str:
    """
    Transcribes a video file from GCS and returns the transcript with word-level timestamps.

    Args:
        gcs_uri: The Google Cloud Storage path to the video file.
                 (e.g., "gs://your-bucket/your-video.mp4")

    Returns:
        The full JSON response from the Speech-to-Text API.
    """
    print(f"Starting transcription for {gcs_uri}...")
    client = speech.SpeechClient()

    audio = speech.RecognitionAudio(uri=gcs_uri)
    
    # Configure the request to enable word-level timestamps
    # This also enables automatic punctuation and specifies the model for enhanced accuracy.
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.MP4,
        sample_rate_hertz=16000, # This is a common sample rate, might need adjustment
        language_code="en-US",
        enable_automatic_punctuation=True,
        enable_word_time_offsets=True,
        model="video", # Use a model optimized for audio from video
    )

    operation = client.long_running_recognize(config=config, audio=audio)

    print("Waiting for transcription operation to complete...")
    response = operation.result(timeout=900) # 15-minute timeout
    print("Transcription finished.")

    # Structure the response to be similar to our previous format
    # while retaining the rich data from Google's API.
    structured_response = {
        "text": "",
        "segments": []
    }
    
    full_transcript = []
    
    for result in response.results:
        # The first alternative is the most likely recognition
        alternative = result.alternatives[0]
        full_transcript.append(alternative.transcript)
        
        # Extract word-level details for segments
        words = []
        for word_info in alternative.words:
            start_time = word_info.start_time.total_seconds()
            end_time = word_info.end_time.total_seconds()
            words.append({
                "word": word_info.word,
                "start": start_time,
                "end": end_time,
            })
        
        structured_response["segments"].append({
            "text": alternative.transcript,
            "words": words,
            "start": words[0]['start'] if words else None,
            "end": words[-1]['end'] if words else None,
        })

    structured_response["text"] = " ".join(full_transcript)
    
    return structured_response

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <gcs_uri>", file=sys.stderr)
        sys.exit(1)

    gcs_path = sys.argv[1]
    transcription = transcribe_gcs_with_timestamps(gcs_path)

    if transcription:
        print(json.dumps(transcription, indent=2)) 