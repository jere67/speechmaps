"use client";

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { Video } from 'lucide-react';

interface VoiceInputProps {
  setNavVisible: (visible: boolean) => void;
  setNavMessage: (navItem: string) => void;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ setNavVisible, setNavMessage }) => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const DEFAULT_CITY = 'Ann Arbor';
  const DEFAULT_STATE = 'MI';
  const DEFAULT_LOCATION = `${DEFAULT_CITY}, ${DEFAULT_STATE}`;

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
          setNavVisible(true); 
          setNavMessage("Error transcribing audio.");
        }
      };

      mediaRecorder.start();
      console.log('Recording started');
      setRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setNavVisible(true); 
      setNavMessage("Error starting recording.");
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
      setNavVisible(true); 
      setNavMessage("Could not extract road name from your speech.");
      return;
    }

    try {
      const { latitude, longitude } = await getCoordinatesFromRoadName(roadName);
      console.log('Coordinates obtained:', { latitude, longitude });
      await saveReport(text, latitude, longitude);
    } catch (error) {
      console.error('Error handling transcript:', error);
      setNavVisible(true); 
      setNavMessage("Error handling transcript.");
    }
  };

  const extractRoadName = (text: string): string | null => {
    console.log('extractRoadName called with text:', text);
    
    // Define common road types
    const roadTypes = [
      'road',
      'street',
      'avenue',
      'boulevard',
      'lane',
      'drive',
      'court',
      'place',
      'terrace',
      'parkway',
      'commons',
      'circle',
      'highway',
      'expressway',
      'way',
      'route',
    ];

    const roadTypePattern = roadTypes.join('|');

    const regexPrimary = new RegExp(
      `(?:on|at|in)\\s+([A-Za-z\\s]+)\\s+(${roadTypePattern})(?:\\s*(?:,|in)\\s*([A-Za-z\\s]+))?`,
      'i'
    );

    const regexSecondary = new RegExp(
      `([A-Za-z\\s]+)\\s+(${roadTypePattern})(?:\\s*(?:,|in)\\s*([A-Za-z\\s]+))?`,
      'i'
    );

    let match = text.match(regexPrimary);
    if (match && match.length >= 3) {
      const roadName = `${match[1].trim()} ${match[2].trim()}`;
      const cityName = match[3] ? match[3].trim() : '';
      const fullAddress = cityName ? `${roadName}, ${cityName}` : roadName;
      console.log('Road name extracted using primary regex:', fullAddress);
      return fullAddress;
    }

    match = text.match(regexSecondary);
    if (match && match.length >= 3) {
      const roadName = `${match[1].trim()} ${match[2].trim()}`;
      const cityName = match[3] ? match[3].trim() : '';
      const fullAddress = cityName ? `${roadName}, ${cityName}` : roadName;
      console.log('Road name extracted using secondary regex:', fullAddress);
      return fullAddress;
    }

    console.log('No road name matched.');
    return null;
  };

  const getCoordinatesFromRoadName = async (roadAddress: string) => {
    console.log('getCoordinatesFromRoadName called with roadAddress:', roadAddress);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key is not defined.');
      throw new Error('Google Maps API key is not defined.');
    }

    // Determine if the roadAddress includes a city by checking for a comma
    // If no city is provided, append the default location
    const address = roadAddress.includes(',') ? roadAddress : `${roadAddress}, ${DEFAULT_LOCATION}`;
    console.log('Final address for geocoding:', address);

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address,
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
        setNavVisible(true); 
        setNavMessage("Error saving report.");
      } else {
        console.log('Report saved successfully:', data);
        setNavVisible(true); 
        setNavMessage("Report saved successfully!");
        
      }
    } catch (error) {
      console.error('Exception saving report:', error);
      setNavVisible(true); 
      setNavMessage("Exception saving report");
    }
  };

  return (
    <div className="p-4 flex flex-col items-center">
      <button
        onClick={recording ? stopRecording : startRecording}
        className={`flex items-center justify-center px-6 py-3 text-sm font-medium text-white transition duration-200 ease-in-out ${
          recording
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-green-600 hover:bg-green-700'
        } rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
      >
        <Video className="mr-2 h-5 w-5" />
        {recording ? 'Stop Recording' : 'Start Recording'}
      </button>
      {transcript && (
        <div className="mt-4 w-full">
          <p className="text-black">Transcript: {transcript}</p>
        </div>
      )}
    </div>
  );
};

export default VoiceInput;