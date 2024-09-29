// app/page.tsx
import React from 'react';
import Map from '../components/Map';
import VoiceInput from '../components/VoiceInput';

const HomePage: React.FC = () => {
  return (
    <div>
      <h1>Your Map Application</h1>
      <Map />
      <VoiceInput />
    </div>
  );
};

export default HomePage;
