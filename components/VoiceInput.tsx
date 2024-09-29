"use client";

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { Video } from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition | undefined;
    webkitSpeechRecognition: typeof SpeechRecognition | undefined;
  }

  var SpeechRecognition: any;
  var webkitSpeechRecognition: any;
}

type ISpeechRecognition = {
  new (): SpeechRecognitionInstance;
};

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: ArrayLike<{
    [index: number]: {
      transcript: string;
    };
  }>;
}

interface VoiceInputProps {
  setNavVisible: (visible: boolean) => void;
  setNavMessage: (navItem: string) => void;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ setNavVisible, setNavMessage }) => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isRecognitionActive = useRef(false);

  const DEFAULT_CITY = 'Ann Arbor';
  const DEFAULT_STATE = 'MI';
  const DEFAULT_LOCATION = `${DEFAULT_CITY}, ${DEFAULT_STATE}`;

  const wakeWord = "speech maps";
  useEffect(() => {
    const initializeRecognition = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        const SpeechRecognition: ISpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          console.error("Web Speech API is not supported in this browser.");
          setNavVisible(true);
          setNavMessage('Web Speech API not supported in this browser.');
          return;
        }
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const spokenText = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
          console.log('Wake word detection result:', spokenText);
          if (spokenText.includes(wakeWord)) {
            console.log('Wake word detected, starting recording...');
            setNavVisible(true);
            setNavMessage('SpeechMaps is listening...');
            startRecording();
          }
        };
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setNavVisible(true);
            setNavMessage('Microphone access not allowed. Please check your browser settings.');
            return;
          }
          isRecognitionActive.current = false;
          restartRecognition();
        };

        recognition.onend = () => {
          console.log('Speech recognition ended, restarting...');
          isRecognitionActive.current = false;
          restartRecognition();
        };

        recognition.start();
        isRecognitionActive.current = true;
        console.log('Listening for wake word...');
        setNavVisible(true);
        setNavMessage('Listening for wake word...');
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setNavVisible(true);
        setNavMessage('Error accessing microphone. Please allow microphone access in your browser settings.');
      }
    };
    initializeRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        isRecognitionActive.current = false;
      }
    };
  }, []);

  const restartRecognition = () => {
    if (recognitionRef.current && !isRecognitionActive.current) {
      setTimeout(() => {
        if (recognitionRef.current && !isRecognitionActive.current) {
          try {
            recognitionRef.current.start();
            isRecognitionActive.current = true;
            console.log('Recognition restarted');
            setNavVisible(true);
            setNavMessage('Listening for wake word...');
          } catch (error) {
            console.error('Error restarting recognition:', error);
          }
        }
      }, 1000); //adding a delay of 1000 ms before mandatory restart
    }
  };

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
          const response = await fetch('http://localhost:3000/api/groq', {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
            },
          });

          if (!response.ok) {
            console.error('Error transcribing audio:', response.statusText);
            setNavVisible(true);
            setNavMessage("Error transcribing audio.");
            return;
          }

          const responseData = await response.json();
          const transcriptionText: string = responseData.text;
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

      setTimeout(() => {
        stopRecording();
      }, 6000);
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
      setNavVisible(true);
      setNavMessage('Listening for wake word...');
      restartRecognition(); //resume wake-word detection after recording stops
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

    //define common road types
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

    //if no city is provided, append the default location
    const address = roadAddress.includes(',') ? roadAddress : `${roadAddress}, ${DEFAULT_LOCATION}`;
    console.log('Final address for geocoding:', address);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          address
        )}&key=${apiKey}`
      );
      const responseData = await response.json();

      if (responseData.status === 'OK') {
        const location = responseData.results[0].geometry.location;
        console.log('Coordinates found:', location);
        return {
          latitude: location.lat,
          longitude: location.lng,
        };
      } else {
        console.error('Geocoding API error:', responseData.status);
        throw new Error('Geocoding API error: ' + responseData.status);
      }
    } catch (error) {
      console.error('Error fetching coordinates:', error);
      throw error;
    }
  };

  const saveReport = async (description: string, latitude: number, longitude: number) => {
    console.log('saveReport called with:', { description, latitude, longitude });
    try {
      const anonymousUserId = uuidv4(); //generate a random UUID

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
          <p className="text-black">SpeechMaps heard: {transcript}</p>
        </div>
      )}
    </div>
  );
};

export default VoiceInput;