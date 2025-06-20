import asyncio, socketio, os
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler

ROOM = "room1"                       # or pass in argv/env
PCM_SR = 16000                       # 8 kHz also works
ENDPOINT = "http://localhost:3000"   # Node server

sio = socketio.AsyncClient()         # python-socketio client

# Queue that decouples network jitter from AWS streaming back-pressure
audio_q: asyncio.Queue[bytes] = asyncio.Queue(maxsize=200)

@sio.event
async def connect():
    await sio.emit('join', ROOM)
    print("🎤   joined Socket.IO room →", ROOM)

# Receive binary PCM chunks from Node
@sio.on("audio")
async def on_audio(chunk: bytes):
    await audio_q.put(chunk)

# Async generator that Transcribe SDK accepts as “microphone”
async def incoming_audio():
    while True:
        chunk = await audio_q.get()
        yield chunk

async def main():
    await sio.connect(ENDPOINT)

    client  = TranscribeStreamingClient(region="us-west-2")
    stream  = await client.start_stream_transcription(
        language_code="en-US",
        media_sample_rate_hz=PCM_SR,
        media_encoding="pcm",
    )

    # ──► push browser audio into the SDK
    async def writer():
        async for chunk in incoming_audio():
            await stream.input_stream.write(chunk)

    # ◄── push AWS results back to browser & stdout
    class Handler(TranscriptResultStreamHandler):
        async def handle_transcript_event(self, evt):
            for res in evt.transcript.results:
                text = res.alternatives[0].transcript
                print(("Partial: " if res.is_partial else "Final : ") + text)
                await sio.emit("transcript", {
                    "room": ROOM,
                    "text": text,
                    "isFinal": not res.is_partial,
                })

    await asyncio.gather(writer(), Handler(stream.output_stream).handle_events())

if __name__ == "__main__":
    asyncio.run(main())
