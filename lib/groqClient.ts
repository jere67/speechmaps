// lib/groqClient.ts

import Groq from 'groq-sdk';

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.error('GROQ_API_KEY is not defined in environment variables.');
  throw new Error('GROQ_API_KEY is not defined in environment variables.');
}

export const groqClient = new Groq({
  apiKey: groqApiKey,
});
