"use client";

import React, { useState } from "react";
import { Package } from "lucide-react";
import { Hero } from "@/components/hero";
import { BoxBg } from "@/components/box-bg";
import { BoxBgHorizontal } from "@/components/box-bg-horizontal";
import { ProfileBoxBg } from "@/components/profile-box-bg";
import { Features } from "@/components/features";
import { HowItWorks } from "@/components/how-it-works";
import { Profile } from "@/components/profile";

type ViewState = "home" | "features" | "how-it-works" | "profile";

const ANIMATION_STYLES = [
  "slide-right",
  "slide-left",
  "slide-up",
  "slide-down",
  "zoom-in",
  "zoom-out",
  "spin-left",
  "spin-right"
];

const getAnimationClasses = (style: string, active: boolean) => {
  if (active) {
    return "opacity-100 translate-x-0 translate-y-0 scale-100 rotate-0";
  }
  switch (style) {
    case "slide-left":
      return "opacity-0 -translate-x-16 scale-95 pointer-events-none absolute";
    case "slide-up":
      return "opacity-0 -translate-y-16 scale-95 pointer-events-none absolute";
    case "slide-down":
      return "opacity-0 translate-y-16 scale-95 pointer-events-none absolute";
    case "zoom-in":
      return "opacity-0 scale-75 pointer-events-none absolute";
    case "zoom-out":
      return "opacity-0 scale-110 pointer-events-none absolute";
    case "spin-left":
      return "opacity-0 scale-90 -rotate-6 pointer-events-none absolute";
    case "spin-right":
      return "opacity-0 scale-90 rotate-6 pointer-events-none absolute";
    case "slide-right":
    default:
      return "opacity-0 translate-x-16 scale-95 pointer-events-none absolute";
  }
};

export default function Home() {
  const [view, setView] = useState<ViewState>("home");
  const [boxView, setBoxView] = useState<ViewState | null>(null);
  const [isBoxAnimatingOut, setIsBoxAnimatingOut] = useState(false);
  const [animationStyle, setAnimationStyle] = useState<string>("slide-right");
  const [profileMode, setProfileMode] = useState<"login" | "register">("login");

  const transitionTo = (newView: ViewState, authMode?: "login" | "register") => {
    if (authMode) {
      setProfileMode(authMode);
    }
    if (newView === view) return;

    const nextStyle = ANIMATION_STYLES[Math.floor(Math.random() * ANIMATION_STYLES.length)];
    setAnimationStyle(nextStyle);

    if (newView === "home") {
      setIsBoxAnimatingOut(true);
      setTimeout(() => {
        setView("home");
        setBoxView(null);
        setIsBoxAnimatingOut(false);
      }, 350);
    } else {
      if (view === "home") {
        setView(newView);
        setBoxView(newView);
      } else {
        setIsBoxAnimatingOut(true);
        setTimeout(() => {
          setView(newView);
          setBoxView(newView);
          setIsBoxAnimatingOut(false);
        }, 350);
      }
    }
  };

  return (
    <main
      className="relative w-full min-h-screen md:h-screen overflow-y-auto md:overflow-hidden select-none font-sans"
      style={{
        backgroundImage: "url('/BG1.png')",
        backgroundSize: "100% 110%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      <div className="relative z-10 w-full min-h-screen md:h-full flex flex-col justify-between p-4 md:p-[4vh]">
        {/* Header section containing logo and navigation links */}
        <header className="w-full flex flex-col md:flex-row items-center md:justify-start gap-4 md:gap-[8vh] pb-4 md:pb-0">
          {/* Logo Container */}
          <div 
            onClick={() => transitionTo("home")}
            className="flex items-center gap-[2vh] text-[#3D2310] cursor-pointer font-merriweather hover:scale-102 transition-transform duration-200 group"
          >
            <Package className="w-[5vh] h-[5vh] md:w-[6vh] md:h-[6vh] stroke-[2.2]" />
            <span className="font-black text-3xl md:text-[5vh] tracking-tight">Secure Box</span>
          </div>

          {/* Navigation Links: Hidden on Home view, revealed when navigating sub-views */}
          <nav className="flex flex-wrap justify-center items-center gap-4 md:gap-[5vh] font-merriweather">
            <div
              className={`flex items-center gap-4 md:gap-[5vh] transition-all duration-350 ease-in-out ${
                view !== "home"
                  ? "opacity-100 translate-x-0 max-w-[600px] pointer-events-auto"
                  : "opacity-0 -translate-x-3 max-w-0 overflow-hidden pointer-events-none"
              }`}
            >
              <a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  transitionTo("features");
                }}
                className="relative py-[0.5vh] text-base md:text-[2.6vh] font-black text-[#3D2310] whitespace-nowrap transition-colors duration-200 group"
              >
                Features
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] bg-[#3D2310] rounded-full transition-all duration-350 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${
                  view === "features" ? "w-full" : "w-0 group-hover:w-full"
                }`} />
              </a>

              <a
                href="#how-it-works"
                onClick={(e) => {
                  e.preventDefault();
                  transitionTo("how-it-works");
                }}
                className="relative py-[0.5vh] text-base md:text-[2.6vh] font-black text-[#3D2310] whitespace-nowrap transition-colors duration-200 group"
              >
                How it works
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] bg-[#3D2310] rounded-full transition-all duration-350 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${
                  view === "how-it-works" ? "w-full" : "w-0 group-hover:w-full"
                }`} />
              </a>

              <a
                href="#signin"
                onClick={(e) => {
                  e.preventDefault();
                  transitionTo("profile", "login");
                }}
                className="relative py-[0.5vh] text-base md:text-[2.6vh] font-black text-[#3D2310] whitespace-nowrap transition-colors duration-200 group"
              >
                Sign In
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] bg-[#3D2310] rounded-full transition-all duration-350 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${
                  view === "profile" && profileMode === "login" ? "w-full" : "w-0 group-hover:w-full"
                }`} />
              </a>
            </div>
          </nav>
        </header>

        {/* Content area wrapper holding the Hero info / BoxBg */}
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center md:justify-start px-4 md:pl-16 lg:pl-24 relative py-6 md:py-0 w-full">
          
          {/* HERO VIEW */}
          <div 
            className={`transition-all duration-500 ease-in-out transform w-full md:w-auto flex justify-center md:justify-start ${
              view === "home" 
                ? "opacity-100 translate-x-0 scale-100" 
                : "opacity-0 -translate-x-12 scale-95 pointer-events-none absolute"
            }`}
          >
            <Hero 
              onExploreFeatures={() => transitionTo("features")}
              onHowItWorks={() => transitionTo("how-it-works")}
              onOrderNow={() => transitionTo("profile", "register")}
            />
          </div>

          {/* DYNAMIC PARCEL VIEW */}
          <div 
            className={`transition-all duration-500 ease-in-out transform w-full md:w-auto flex justify-center md:justify-start ${
              getAnimationClasses(animationStyle, view !== "home" && !isBoxAnimatingOut)
            }`}
          >
            {boxView === "how-it-works" ? (
              <BoxBgHorizontal>
                <HowItWorks />
              </BoxBgHorizontal>
            ) : boxView === "profile" ? (
              <ProfileBoxBg>
                <Profile mode={profileMode} />
              </ProfileBoxBg>
            ) : (
              <BoxBg>
                {boxView === "features" && <Features />}
              </BoxBg>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
