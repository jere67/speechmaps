import React from "react";
import { BackgroundBeamsWithCollision } from "./background-beams-with-collision";

export function Loading() {
  return (
    <div className="h-screen flex items-center justify-center">
      <BackgroundBeamsWithCollision className="min-h-full w-full">
        <h2 className="text-2xl relative z-20 md:text-4xl lg:text-7xl font-bold text-center text-black dark:text-white font-sans tracking-tight">
          <div className="relative mx-auto inline-block w-max [filter:drop-shadow(0px_1px_3px_rgba(27,_37,_80,_0.14))] h-full">
            <div className="relative bg-clip-text text-transparent bg-no-repeat bg-gradient-to-r from-purple-500 via-violet-500 to-pink-500 py-4 h-full">
              <span className="">Loading Map</span>
            </div>
          </div>
        </h2>
      </BackgroundBeamsWithCollision>
    </div>
  );
}