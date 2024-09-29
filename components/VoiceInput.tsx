// app/components/VoiceInput.tsx
"use client";

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid'; // Install uuid package if not already installed

const VoiceInput: React.FC = () => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    console.log('startRecording called');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Media stream obtained:', stream);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        console.log('Data available:', event.data);
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('Audio blob created:', audioBlob);
        audioChunksRef.current = [];

        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');

        try {
          console.log('Sending audio to /api/groq');
          const response = await axios.post('/api/groq', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          const transcriptionText = response.data.text;
          console.log('Transcription received:', transcriptionText);
          setTranscript(transcriptionText);
          await handleTranscript(transcriptionText);
        } catch (error) {
          console.error('Error transcribing audio:', error);
          alert('Error transcribing audio: ' + error);
        }
      };

      mediaRecorder.start();
      console.log('Recording started');
      setRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error starting recording: ' + error);
    }
  };

  const stopRecording = () => {
    console.log('stopRecording called');
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    } else {
      console.warn('mediaRecorderRef.current is null');
    }
  };

  const handleTranscript = async (text: string) => {
    console.log('handleTranscript called with text:', text);
    const roadName = extractRoadName(text);
    console.log('Extracted road name:', roadName);

    if (!roadName) {
      alert('Could not extract road name from your speech.');
      return;
    }

    try {
      const { latitude, longitude } = await getCoordinatesFromRoadName(roadName);
      console.log('Coordinates obtained:', { latitude, longitude });
      await saveReport(text, latitude, longitude);
    } catch (error) {
      console.error('Error handling transcript:', error);
      alert('Error handling transcript: ' + error);
    }
  };

  const extractRoadName = (text: string): string | null => {
    console.log('extractRoadName called with text:', text);
    // Adjusted regex to be more flexible
    const regex = /on\s+(.+?)(?:\s+heading|\s*$)/i;
    const match = text.match(regex);
    const roadName = match ? match[1].trim() : null;
    console.log('Road name extracted:', roadName);
    return roadName;
  };

  const getCoordinatesFromRoadName = async (roadName: string) => {
    console.log('getCoordinatesFromRoadName called with roadName:', roadName);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key is not defined.');
      throw new Error('Google Maps API key is not defined.');
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: roadName,
          key: apiKey,
        },
      });
      console.log('Geocoding response:', response.data);

      if (response.data.status === 'OK') {
        const location = response.data.results[0].geometry.location;
        console.log('Coordinates found:', location);
        return {
          latitude: location.lat,
          longitude: location.lng,
        };
      } else {
        console.error('Geocoding API error:', response.data.status);
        throw new Error('Geocoding API error: ' + response.data.status);
      }
    } catch (error) {
      console.error('Error fetching coordinates:', error);
      throw error;
    }
  };

  const saveReport = async (description: string, latitude: number, longitude: number) => {
    console.log('saveReport called with:', { description, latitude, longitude });
    try {
      const anonymousUserId = uuidv4(); // Generate a random UUID
  
      const { data, error } = await supabase.from('reports').insert([
        {
          user_id: anonymousUserId,
          description,
          latitude,
          longitude,
        },
      ]);
  
      if (error) {
        console.error('Error saving report:', error);
        alert('Error saving report: ' + error);
      } else {
        console.log('Report saved successfully:', data);
        alert('Report saved successfully.');
      }
    } catch (error) {
      console.error('Exception saving report:', error);
      alert('Exception saving report: ' + error);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={recording ? stopRecording : startRecording}
        className={`px-4 py-2 rounded ${
          recording ? 'bg-red-500' : 'bg-green-500'
        } text-white`}
      >
        {recording ? 'Stop Recording' : 'Start Recording'}
      </button>
      {transcript && <p className="mt-2">Transcript: {transcript}</p>}
    </div>
  );
};

export default VoiceInput;
