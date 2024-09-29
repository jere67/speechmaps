// app/page.tsx
import React from 'react';
import Map from '../components/Map';
import VoiceInput from '../components/VoiceInput';
import { Navbar } from '@/components/ui/Navbar';


const HomePage: React.FC = () => {
  return (
    <div>
      <Map />
    </div>
  );
};

export default HomePage;
