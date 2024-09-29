"use client";
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const FloatingNav = ({
  navItem,
  className,
  visible,
  setVisible,
}: {
  navItem: string;
  className?: string;
  visible: boolean;
  setVisible: (value: boolean) => void;
}) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [visible, setVisible]);

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          initial={{
            opacity: 1,
            y: -100,
          }}
          animate={{
            y: 0,
            opacity: 1,
          }}
          exit={{
            y: -100,
            opacity: 0,
          }}
          transition={{
            duration: 0.2,
          }}
          className={cn(
            "flex max-w-fit fixed top-2 inset-x-0 mx-auto border border-transparent dark:border-white/[0.2] rounded-full bg-white shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] z-[5000] py-2 items-center justify-center",
            className
          )}
        >
          <div className="flex items-center justify-center w-full max-w-xs mx-8">
            <span
              className={cn(
                "relative text-black flex items-center justify-center dark:hover:text-neutral-300 hover:text-neutral-500"
              )}
            >
              <span className="block text-sm text-center">{navItem}</span>
              <span className="absolute inset-x-0 w-1/2 mx-auto -bottom-px bg-gradient-to-r from-transparent via-blue-500 to-transparent h-px" />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};