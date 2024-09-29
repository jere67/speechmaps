// app/api/groq/route.ts

import { NextResponse } from 'next/server';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const groqApiKey = process.env.GROQ_API_KEY;
const base_url = process.env.GROQ_API_URL;

if (!groqApiKey) {
  console.error('GROQ_API_KEY is not defined in environment variables.');
  throw new Error('GROQ_API_KEY is not defined in environment variables.');
}

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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('File buffer created, size:', buffer.length);

    const tempDir = path.join(process.cwd(), 'tmp');
    const tempFilePath = path.join(tempDir, `upload-${Date.now()}.webm`);
    console.log('Temporary file path:', tempFilePath);
    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.writeFile(tempFilePath, buffer);
    console.log('File written to disk');

    try {
      const fileStream = fs.createReadStream(tempFilePath);
      const formData = new FormData();
      formData.append('file', fileStream);
      formData.append('model', 'distil-whisper-large-v3-en');
      formData.append('temperature', '0');
      formData.append('response_format', 'json');
      formData.append('language', 'en');

      //send file to the Groq API
      console.log('Sending file to Groq API for transcription');
      const response = await fetch(`${base_url}/openai/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: formData as any,
      });

      if (!response.ok) {
        console.error('Error transcribing audio:', response.statusText);
        return NextResponse.json({ error: 'Error transcribing audio' }, { status: response.status });
      }

      const transcription = await response.json();
      console.log('Transcription received:', transcription.text);
      return NextResponse.json({ text: transcription.text }, { status: 200 });
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return NextResponse.json({ error: 'Error transcribing audio' }, { status: 500 });
    } finally {
      //delet temporary file
      await fs.promises.unlink(tempFilePath);
      console.log('Temporary file deleted');
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return NextResponse.json({ error: 'Error handling request' }, { status: 500 });
  }
}