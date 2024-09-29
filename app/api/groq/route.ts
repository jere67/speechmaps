// app/api/groq/route.ts

import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.error('GROQ_API_KEY is not defined in environment variables.');
  throw new Error('GROQ_API_KEY is not defined in environment variables.');
}

const groq = new Groq({
  apiKey: groqApiKey,
});

export async function POST(request: Request) {
  console.log('POST /api/groq called');
  try {
    const contentType = request.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);

    if (!contentType.includes('multipart/form-data')) {
      console.error('Expected multipart/form-data');
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const formData = await request.formData();
    console.log('Form data parsed');

    const file = formData.get('file') as File | null;
    if (!file) {
      console.error('No file uploaded.');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log('File received:', file.name, file.size, file.type);

    //get the file data as a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('File buffer created, size:', buffer.length);

    //create and write to temporary file path
    const tempDir = path.join(process.cwd(), 'tmp');
    const tempFilePath = path.join(tempDir, `upload-${Date.now()}.webm`);
    console.log('Temporary file path:', tempFilePath);
    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.writeFile(tempFilePath, buffer);
    console.log('File written to disk');

    try {
      const fileStream = fs.createReadStream(tempFilePath);

      //send file to the Groq API
      console.log('Sending file to Groq API for transcription');
      const transcription = await groq.audio.transcriptions.create({
        file: fileStream,
        model: 'distil-whisper-large-v3-en',
      });

      console.log('Transcription received:', transcription.text);
      return NextResponse.json({ text: transcription.text }, { status: 200 });
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return NextResponse.json({ error: 'Error transcribing audio' }, { status: 500 });
    } finally {
      //delete temporary file
      await fs.promises.unlink(tempFilePath);
      console.log('Temporary file deleted');
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return NextResponse.json({ error: 'Error handling request' }, { status: 500 });
  }
}
