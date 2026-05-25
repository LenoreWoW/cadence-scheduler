import React, { useState, useEffect, useRef } from 'react';

// Scene content data - professional messaging
const sceneData = [
  { 
    title: "Time,", 
    subtitle: "Curated.", 
    description: "Premium scheduling for teams who value every moment.",
    label: "Scheduling Reimagined"
  },
  { 
    title: "Plan", 
    subtitle: "Smarter.", 
    description: "Intelligent scheduling that adapts to your workflow.",
    label: "Smart Planning"
  },
  { 
    title: "Connect", 
    subtitle: "Seamlessly.", 
    description: "One link. Any meeting. No friction.",
    label: "Effortless Booking"
  },
  { 
    title: "Scale", 
    subtitle: "Together.", 
    description: "From solo to team — grow without limits.",
    label: "Built for Growth"
  },
  { 
    title: "Start", 
    subtitle: "Now.", 
    description: "Your scheduling journey begins here.",
    label: "Ready to Begin"
  },
];

export const LoginScene3D = () => {
  const [currentScene, setCurrentScene] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedDeltaRef = useRef(0);

  // Handle scroll/wheel events
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      if (isScrollingRef.current || isTransitioning) return;
      
      accumulatedDeltaRef.current += e.deltaY;
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        const delta = accumulatedDeltaRef.current;
        accumulatedDeltaRef.current = 0;
        
        if (Math.abs(delta) < 30) return;
        
        isScrollingRef.current = true;
        setIsTransitioning(true);
        
        if (delta > 0 && currentScene < 4) {
          setCurrentScene(prev => Math.min(prev + 1, 4));
        } else if (delta < 0 && currentScene > 0) {
          setCurrentScene(prev => Math.max(prev - 1, 0));
        }
        
        setTimeout(() => {
          isScrollingRef.current = false;
          setIsTransitioning(false);
        }, 800);
      }, 50);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentScene, isTransitioning]);

  // Parallax effect on mouse move
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const scene = sceneData[currentScene];

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden"
    >
      {/* Professional Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f1a]">
        {/* Animated gradient orbs */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-3xl transition-transform duration-1000"
          style={{
            background: 'radial-gradient(circle, #8A1538 0%, transparent 70%)',
            top: '10%',
            left: '20%',
            transform: `translate(${mousePos.x * -30}px, ${mousePos.y * -30}px)`,
          }}
        />
        <div 
          className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl transition-transform duration-1000"
          style={{
            background: 'radial-gradient(circle, #A29475 0%, transparent 70%)',
            bottom: '20%',
            right: '10%',
            transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)`,
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-3xl transition-transform duration-1000"
          style={{
            background: 'radial-gradient(circle, #4194b3 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: `translate(${mousePos.x * 15}px, ${mousePos.y * 15}px)`,
          }}
        />
      </div>

      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Floating geometric shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Clock-inspired circle */}
        <div 
          className="absolute w-72 h-72 border border-white/10 rounded-full"
          style={{
            top: '15%',
            right: '25%',
            transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -20}px)`,
          }}
        >
          <div className="absolute inset-4 border border-white/5 rounded-full" />
          <div className="absolute inset-8 border border-white/5 rounded-full" />
          {/* Clock hands */}
          <div className="absolute top-1/2 left-1/2 w-px h-16 bg-gradient-to-t from-[#8A1538] to-transparent origin-bottom -translate-x-1/2 rotate-45" />
          <div className="absolute top-1/2 left-1/2 w-px h-24 bg-gradient-to-t from-white/30 to-transparent origin-bottom -translate-x-1/2 -rotate-12" />
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-[#8A1538] rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Floating lines */}
        <div 
          className="absolute w-40 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{
            top: '30%',
            left: '10%',
            transform: `translateY(${mousePos.y * 10}px) rotate(-15deg)`,
          }}
        />
        <div 
          className="absolute w-32 h-px bg-gradient-to-r from-transparent via-[#8A1538]/40 to-transparent"
          style={{
            top: '60%',
            left: '5%',
            transform: `translateY(${mousePos.y * -15}px) rotate(10deg)`,
          }}
        />
        <div 
          className="absolute w-24 h-px bg-gradient-to-r from-transparent via-[#A29475]/30 to-transparent"
          style={{
            bottom: '25%',
            right: '30%',
            transform: `translateY(${mousePos.y * 12}px) rotate(-5deg)`,
          }}
        />

        {/* Small dots */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{
              left: `${15 + (i * 7)}%`,
              top: `${20 + Math.sin(i) * 30}%`,
              transform: `translateY(${mousePos.y * (5 + i)}px)`,
              opacity: 0.1 + (i % 3) * 0.1,
            }}
          />
        ))}
      </div>

      {/* Scene Indicator Dots */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
        {[0, 1, 2, 3, 4].map((i) => (
          <button
            key={i}
            onClick={() => {
              if (!isTransitioning) {
                setIsTransitioning(true);
                setCurrentScene(i);
                setTimeout(() => setIsTransitioning(false), 800);
              }
            }}
            className={`transition-all duration-500 ${
              i === currentScene 
                ? 'w-3 h-3 bg-[#8A1538] rounded-full shadow-lg shadow-[#8A1538]/50' 
                : 'w-2 h-2 bg-white/30 rounded-full hover:bg-white/50 hover:scale-125'
            }`}
          />
        ))}
      </div>

      {/* Main Content with Parallax Text */}
      <div 
        className="absolute bottom-0 left-0 p-8 md:p-12 z-10 transition-transform duration-300 ease-out"
        style={{
          transform: `translate(${mousePos.x * 10}px, ${mousePos.y * 10}px)`,
        }}
      >
        <div className="max-w-lg space-y-6">
          {/* Label */}
          <div 
            className="flex items-center gap-3 overflow-hidden"
            key={`label-${currentScene}`}
          >
            <span className="h-px w-12 bg-gradient-to-r from-[#8A1538] to-transparent" />
            <span 
              className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#8A1538] animate-slide-in"
              style={{ animationDelay: '0ms' }}
            >
              {scene.label}
            </span>
          </div>

          {/* Main Title */}
          <div className="overflow-hidden">
            <h2 
              key={`title-${currentScene}`}
              className="text-5xl md:text-6xl lg:text-7xl font-display font-light text-white leading-[0.95] tracking-tight"
            >
              <span className="block overflow-hidden">
                <span 
                  className="block animate-slide-up"
                  style={{ animationDelay: '100ms' }}
                >
                  {scene.title}
                </span>
              </span>
              <span className="block overflow-hidden">
                <span 
                  className="block font-serif italic bg-gradient-to-r from-[#8A1538] via-[#A29475] to-[#8A1538] bg-clip-text text-transparent animate-slide-up bg-[length:200%_100%] animate-gradient"
                  style={{ animationDelay: '200ms' }}
                >
                  {scene.subtitle}
                </span>
              </span>
            </h2>
          </div>

          {/* Description */}
          <div className="overflow-hidden">
            <p 
              key={`desc-${currentScene}`}
              className="text-gray-400 text-sm md:text-base leading-relaxed max-w-sm animate-slide-up"
              style={{ animationDelay: '300ms' }}
            >
              {scene.description}
            </p>
          </div>

          {/* Decorative Line */}
          <div className="overflow-hidden">
            <div 
              className="h-px w-24 bg-gradient-to-r from-[#8A1538] via-[#A29475] to-transparent animate-slide-in"
              style={{ animationDelay: '400ms' }}
            />
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      {currentScene < 4 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Scroll</span>
          <div className="w-5 h-8 border border-white/20 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/40 rounded-full animate-scroll-indicator" />
          </div>
        </div>
      )}

      {/* Corner Accents */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l border-t border-white/10" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r border-b border-white/10" />

      {/* Time Display */}
      <div className="absolute bottom-24 right-12 text-white/40 font-mono text-xs tracking-wider z-10">
        <TimeDisplay />
      </div>

      {/* Styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes slide-in {
          from {
            transform: translateX(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes scroll-indicator {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          50% {
            transform: translateY(8px);
            opacity: 1;
          }
        }
        
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .animate-slide-in {
          animation: slide-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .animate-scroll-indicator {
          animation: scroll-indicator 2s ease-in-out infinite;
        }
        
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

// Time Display Component
const TimeDisplay = () => {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-lg font-light text-white/50">
        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </span>
      <span className="text-[10px] text-white/30">
        {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
      </span>
    </div>
  );
};
