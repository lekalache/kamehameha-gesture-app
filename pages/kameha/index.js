import styles from "../../styles/Home.module.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  createDetector,
  SupportedModels,
} from "@tensorflow-models/hand-pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import { drawHands } from "../../lib/utils";
import { KamehamehaDetector } from "../../lib/kamehamehaDetection";
import { KamehamehaEffects } from "../../lib/kamehamehaEffects";
import Link from "next/link";
import Image from "next/image";
import { useAnimationFrame } from "../../lib/hooks/useAnimationFrame";
import * as tfjsWasm from "@tensorflow/tfjs-backend-wasm";
import KamehamehaLifeBar from "../../components/KamehamehaLifeBar";

tfjsWasm.setWasmPaths(
  `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm`
);

async function setupVideo() {
  const video = document.getElementById("video");
  const stream = await window.navigator.mediaDevices.getUserMedia({
    video: true,
  });

  video.srcObject = stream;

  // Wait for video metadata and ensure video dimensions are available
  await new Promise((resolve) => {
    video.onloadedmetadata = () => {
      // Ensure video has valid dimensions before resolving
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
      } else {
        // If dimensions aren't ready, wait a bit more
        setTimeout(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
          } else {
            console.warn("Video dimensions still not ready, proceeding anyway");
            resolve();
          }
        }, 100);
      }
    };
  });

  video.play();

  // Set element dimensions to match video stream
  video.width = video.videoWidth;
  video.height = video.videoHeight;

  console.log(`📹 Video initialized: ${video.videoWidth}x${video.videoHeight}`);
  return video;
}

async function setupDetector() {
  try {
    const model = SupportedModels.MediaPipeHands;
    const detector = await createDetector(model, {
      runtime: "tfjs",
      maxHands: 4,
      modelType: "lite",
    });
    return detector;
  } catch (error) {
    console.error("Error creating detector with tfjs runtime:", error);
    // Fallback to mediapipe with local solution path
    try {
      const detector = await createDetector(SupportedModels.MediaPipeHands, {
        runtime: "mediapipe",
        maxHands: 4,
        solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915`,
      });
      return detector;
    } catch (fallbackError) {
      console.error(
        "Error creating detector with mediapipe runtime:",
        fallbackError
      );
      throw new Error("Failed to initialize hand pose detector");
    }
  }
}

async function setupCanvas(video) {
  // Wait for canvas to be available in DOM
  let canvas = document.getElementById("canvas");
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds maximum wait time
  
  while (!canvas && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    canvas = document.getElementById("canvas");
    attempts++;
  }
  
  if (!canvas) {
    throw new Error("Canvas element not found in DOM after waiting");
  }
  
  const ctx = canvas.getContext("2d");

  // Use videoWidth and videoHeight for proper video stream dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Update canvas size when fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    // When in fullscreen, maintain aspect ratio but centered
    if (document.fullscreenElement) {
      const aspectRatio = video.videoWidth / video.videoHeight;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // Calculate dimensions that maintain aspect ratio and fit within the screen
      let newWidth, newHeight;
      
      if (screenWidth / screenHeight > aspectRatio) {
        // Screen is wider than video, constrain by height
        newHeight = screenHeight * 0.9; // 90% of screen height
        newWidth = newHeight * aspectRatio;
      } else {
        // Screen is taller than video, constrain by width
        newWidth = screenWidth * 0.9; // 90% of screen width
        newHeight = newWidth / aspectRatio;
      }
      
      // Apply the new dimensions via CSS
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;
    } else {
      // Reset canvas size when exiting fullscreen
      canvas.style.width = '';
      canvas.style.height = '';
    }
  });

  return ctx;
}

export default function HandPoseDetection() {
  const router = useRouter();
  
  const detectorRef = useRef();
  const videoRef = useRef();
  const kamehamehaDetectorRef = useRef();
  const kamehamehaEffectsRef = useRef();
  const kamehamehaModeRef = useRef(true); // Always ON
  const chargingAudioRef = useRef();
  const firingAudioRef = useRef();
  const containerRef = useRef();
  const [ctx, setCtx] = useState();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gestureState, setGestureState] = useState("idle");
  const [gestureData, setGestureData] = useState({});
  const [isKamehamehaMode] = useState(true); // Always ON
  const [hasPlayedFiringAudio, setHasPlayedFiringAudio] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kamehamehaCount, setKamehamehaCount] = useState(0);
  const [showWalkthrough, setShowWalkthrough] = useState(false); // Default to false
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    async function initializeVideoAndDetector() {
      try {
        setIsLoading(true);
        setError(null);

        // Step 1: Setup video and detector first
        videoRef.current = await setupVideo();
        detectorRef.current = await setupDetector();

        // Initialize audio elements
        chargingAudioRef.current = new Audio("/charging.m4a");
        firingAudioRef.current = new Audio("/firing.m4a");

        // Set audio properties
        chargingAudioRef.current.loop = true; // Loop charging sound
        chargingAudioRef.current.volume = 0.7;
        firingAudioRef.current.volume = 0.8;

        // Reset firing audio flag when firing sound ends naturally
        firingAudioRef.current.addEventListener("ended", () => {
          console.log("🎵 Firing audio ended naturally");
          // Use a timeout to reset the flag after audio ends
          setTimeout(() => setHasPlayedFiringAudio(false), 100);
        });

        // Set loading to false to render canvas element
        setIsLoading(false);
      } catch (err) {
        console.error("Error initializing video and detector:", err);
        setError(err.message);
        setIsLoading(false);
      }
    }

    // Only initialize if user has started
    if (hasStarted) {
      initializeVideoAndDetector();
    }
  }, [hasStarted]); // Run when hasStarted changes

  // Effect to read URL parameter and set walkthrough state
  useEffect(() => {
    if (router.isReady) {
      const walkthroughParam = router.query.walkthrough;
      console.log('Reading URL walkthrough param:', walkthroughParam);
      const shouldShowWalkthrough = walkthroughParam === 'true';
      setShowWalkthrough(shouldShowWalkthrough);
      
      // Auto-start the game if walkthrough is disabled
      if (!shouldShowWalkthrough) {
        console.log('Walkthrough disabled, auto-starting game...');
        setHasStarted(true);
      }
    }
  }, [router.isReady, router.query.walkthrough]);
  
  // Second effect: Setup canvas and complete initialization after canvas is rendered
  useEffect(() => {
    async function setupCanvasAndEffects() {
      if (!isLoading && !error && videoRef.current && detectorRef.current && !ctx) {
        try {
          // Now setup canvas since it should be rendered
          const canvasCtx = await setupCanvas(videoRef.current);

          // Initialize Kamehameha detection and effects
          kamehamehaDetectorRef.current = new KamehamehaDetector();
          kamehamehaEffectsRef.current = new KamehamehaEffects(
            document.getElementById("canvas"),
            canvasCtx
          );

          // Set up gesture state callback
          kamehamehaDetectorRef.current.onGestureChange = (state, data) => {
            console.log(`🎮 UI State Update: ${state}`, data);
            setGestureState(state);
            setGestureData(data);

            if (state === "charging") {
              console.log("🔵 Kamehameha charging...", data.chargingProgress);
              if (chargingAudioRef.current && chargingAudioRef.current.paused) {
                chargingAudioRef.current.currentTime = 0;
                chargingAudioRef.current
                  .play()
                  .catch((e) => console.log("Audio play failed:", e));
              }
              // Stop firing audio only when starting a new charging cycle
              if (firingAudioRef.current && !firingAudioRef.current.paused) {
                firingAudioRef.current.pause();
                firingAudioRef.current.currentTime = 0;
              }
              setHasPlayedFiringAudio(false); // Reset firing audio flag when charging
            } else if (state === "firing") {
              console.log("⚡ KAMEHAMEHA! FIRING!");
              if (chargingAudioRef.current && !chargingAudioRef.current.paused) {
                chargingAudioRef.current.pause();
                chargingAudioRef.current.currentTime = 0;
              }
              // Play firing sound only once per firing state session
              if (!hasPlayedFiringAudio) {
                if (firingAudioRef.current) {
                  firingAudioRef.current.currentTime = 0;
                  firingAudioRef.current
                    .play()
                    .catch((e) => console.log("Audio play failed:", e));
                }
                setHasPlayedFiringAudio(true);
                // Increment Kamehameha count when firing starts
                setKamehamehaCount(prev => prev + 1);
              }
            } else {
              // Stop charging sound when returning to idle/positioning
              if (chargingAudioRef.current && !chargingAudioRef.current.paused) {
                chargingAudioRef.current.pause();
                chargingAudioRef.current.currentTime = 0;
              }
              // Don't stop firing audio - let it play completely
              // Only reset the flag when no hands are detected (complete reset)
              if (state === "idle") {
                setHasPlayedFiringAudio(false); // Reset firing audio flag only when returning to idle
              }
            }
          };

          setCtx(canvasCtx);
        } catch (err) {
          console.error("Error setting up canvas and effects:", err);
          setError(err.message);
        }
      }
    }

    setupCanvasAndEffects();
  }, [isLoading, error, ctx, hasPlayedFiringAudio]); // Dependencies that affect when this should run

  // Cleanup: stop all sounds when component unmounts
  useEffect(() => {
    return () => {
      if (chargingAudioRef.current) {
        chargingAudioRef.current.pause();
        chargingAudioRef.current.currentTime = 0;
      }
      if (firingAudioRef.current) {
        firingAudioRef.current.pause();
        firingAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Function to toggle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      // Enter fullscreen
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(err => {
          console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else if (containerRef.current.webkitRequestFullscreen) { // Safari
        containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.msRequestFullscreen) { // IE11
        containerRef.current.msRequestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { // Safari
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { // IE11
        document.msExitFullscreen();
      }
    }
  };

  // Handle window resize to adjust canvas dimensions in fullscreen mode
  useEffect(() => {
    const handleResize = () => {
      if (isFullscreen && videoRef.current && ctx) {
        // Adjust canvas size based on window dimensions while maintaining aspect ratio
        const video = videoRef.current;
        const canvas = document.getElementById("canvas");
        
        if (canvas && video.videoWidth && video.videoHeight) {
          const aspectRatio = video.videoWidth / video.videoHeight;
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;
          
          // Keep the internal drawing buffer at the video's native resolution
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Calculate dimensions that maintain aspect ratio and fit within the screen
          let newWidth, newHeight;
          
          if (windowWidth / windowHeight > aspectRatio) {
            // Window is wider than video, constrain by height
            newHeight = windowHeight * 0.9; // 90% of window height
            newWidth = newHeight * aspectRatio;
          } else {
            // Window is taller than video, constrain by width
            newWidth = windowWidth * 0.9; // 90% of window width
            newHeight = newWidth / aspectRatio;
          }
          
          // Apply the new dimensions via CSS
          canvas.style.width = `${newWidth}px`;
          canvas.style.height = `${newHeight}px`;
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Call resize handler immediately if in fullscreen mode
    if (isFullscreen) {
      handleResize();
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isFullscreen, ctx]);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.msFullscreenElement || 
        false
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []); // hasPlayedFiringAudio isn't used in this effect

  useAnimationFrame(async (delta) => {
    // Ensure video has valid dimensions before processing
    if (
      detectorRef.current &&
      videoRef.current &&
      ctx &&
      videoRef.current.videoWidth > 0 &&
      videoRef.current.videoHeight > 0
    ) {
      try {
        // Save canvas state at the beginning of each frame
        ctx.save();

        const hands = await detectorRef.current.estimateHands(
          videoRef.current,
          {
            flipHorizontal: false,
          }
        );

        // Clear canvas and reset to default state
        ctx.clearRect(
          0,
          0,
          videoRef.current.videoWidth,
          videoRef.current.videoHeight
        );

        // Reset canvas properties to defaults to prevent state corruption
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#000000";

        // Draw video frame
        ctx.drawImage(
          videoRef.current,
          0,
          0,
          videoRef.current.videoWidth,
          videoRef.current.videoHeight
        );

        // Draw hand landmarks
        if (!kamehamehaModeRef.current) {
          drawHands(hands, ctx);
        }

        // Debug the mode state - log every 30 frames to avoid spam
        if (Math.random() < 0.03) {
          // ~1% of frames
          console.log(
            `🐛 MODE CHECK: isKamehamehaMode=${isKamehamehaMode}, ref=${
              kamehamehaModeRef.current
            }, detector=${!!kamehamehaDetectorRef.current}, effects=${!!kamehamehaEffectsRef.current}`
          );
        }

        // Kamehameha detection and effects - use ref for current mode to avoid closure issues
        const currentKamehamehaMode = true; // Always ON
        const hasDetector = !!kamehamehaDetectorRef.current;
        const hasEffects = !!kamehamehaEffectsRef.current;

        if (currentKamehamehaMode && hasDetector && hasEffects) {
          console.log(
            `🔥 KAMEHAMEHA MODE ACTIVE - Processing ${
              hands ? hands.length : 0
            } hands`
          );

          // Log individual hand details
          if (hands && hands.length > 0) {
            hands.forEach((hand, index) => {
              const wrist = hand.keypoints.find((kp) => kp.name === "wrist");
              const confidence = hand.score || "unknown";
              console.log(
                `✋ Hand ${index + 1}: score=${confidence}, wrist=${
                  wrist
                    ? `(${wrist.x.toFixed(1)}, ${wrist.y.toFixed(1)})`
                    : "missing"
                }`
              );
            });
          }

          const currentGestureData =
            kamehamehaDetectorRef.current.detectGesture(hands);

          // Render effects with isolated canvas state
          ctx.save();
          try {
            kamehamehaEffectsRef.current.render(
              currentGestureData.state,
              currentGestureData,
              hands
            );
          } finally {
            ctx.restore();
          }

          // Update React state with current gesture data to ensure UI shows real-time progress
          // Only update if state or progress has changed to avoid unnecessary re-renders
          if (
            currentGestureData.state !== gestureState ||
            (currentGestureData.state === "charging" &&
              Math.abs(
                currentGestureData.chargingProgress -
                  (gestureData.chargingProgress || 0)
              ) > 0.01) ||
            (currentGestureData.state === "firing" &&
              Math.abs(
                currentGestureData.firingProgress -
                  (gestureData.firingProgress || 0)
              ) > 0.01)
          ) {
            setGestureState(currentGestureData.state);
            setGestureData(currentGestureData);
          }

          // Draw minimal hand landmarks during Kamehameha mode
          if (hands && hands.length > 0) {
            console.log(
              `👐 Drawing ${hands.length} hands with state: ${currentGestureData.state}`
            );
            hands.forEach((hand, index) => {
              const wrist = hand.keypoints.find((kp) => kp.name === "wrist");
              if (wrist && wrist.score > 0.5) {
                console.log(
                  `✋ Hand ${index + 1} wrist at (${wrist.x.toFixed(
                    1
                  )}, ${wrist.y.toFixed(
                    1
                  )}) - confidence: ${wrist.score.toFixed(2)}`
                );
                ctx.save();
                ctx.fillStyle =
                  currentGestureData.state === "charging"
                    ? "#00ff00"
                    : currentGestureData.state === "firing"
                    ? "#ff0000"
                    : "#ffffff";
                ctx.beginPath();
                ctx.arc(wrist.x, wrist.y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }
            });
          }
        } else {
          // Normal mode - just log occasionally
          if (Math.random() < 0.1) {
            // Log 10% of frames to avoid spam
            console.log(
              `👐 Normal Mode - Detected ${hands ? hands.length : 0} hands`
            );
          }
          if (hands) {
            drawHands(hands, ctx);
          }
        }

        // Always restore canvas state at the end of each frame
        ctx.restore();
      } catch (error) {
        console.error("Error during hand pose detection:", error);
        // Ensure canvas state is restored even if there's an error
        ctx.restore();
      }
    }
  }, !!(detectorRef.current && videoRef.current && ctx));

  const getGestureStatusText = () => {
    switch (gestureState) {
      case "positioning":
        return "";
      case "charging":
        return "";
      case "firing":
        if (gestureData.firingProgress !== undefined) {
          const remainingTime = Math.max(
            0,
            gestureData.allowedFiringDuration -
              gestureData.currentFiringDuration
          );
          const remainingSeconds = Math.ceil(remainingTime / 1000);
          return "";
        }
        return "";
      default:
        // Don't show the "Ready to detect" message
        return "";
    }
  };

  const getGestureInstructions = () => {
    if (!isKamehamehaMode || isFullscreen) return null;


  };

  const handleStart = () => {
    console.log('handleStart called, showWalkthrough:', showWalkthrough);
    setHasStarted(true);
  };

  const handleNextStep = () => {
    // End walkthrough and start detection
    setShowWalkthrough(false);
  };

  const handleSkipWalkthrough = () => {
    setHasStarted(true);
  };

  return (
    <div 
      className={styles.container} 
      ref={containerRef}
      style={isFullscreen ? {
        backgroundColor: 'black',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0,
        margin: 0,
        zIndex: 9999
      } : {}}
    >
      <div style={{
        position: "fixed",
        top: "20px",
        left: "20px",
        zIndex: 10,
        cursor: "pointer",
        opacity: isFullscreen ? 0.6 : 1,
        transition: "opacity 0.3s ease",
      }}
      onMouseOver={e => isFullscreen && (e.currentTarget.style.opacity = "1")}
      onMouseOut={e => isFullscreen && (e.currentTarget.style.opacity = "0.6")}
      >
        <Link href="/">
          <div style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(0, 0, 0, 0.7)",
            padding: "10px",
            borderRadius: "50%",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
            transition: "transform 0.2s, background 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.background = "rgba(248, 91, 26, 0.9)"; // Orange DBZ color
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.background = "rgba(0, 0, 0, 0.7)";
          }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 19L5 12L12 5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>
      </div>
      
      {/* Fullscreen toggle button */}
      <div style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 100, // Higher z-index to ensure it's always on top
        cursor: "pointer",
        opacity: isFullscreen ? 0.6 : 1, // Slightly transparent in fullscreen mode
        transition: "opacity 0.3s ease",
      }}
      onMouseOver={e => isFullscreen && (e.currentTarget.style.opacity = "1")}
      onMouseOut={e => isFullscreen && (e.currentTarget.style.opacity = "0.6")}
      >
        <div 
          onClick={toggleFullscreen}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.7)",
            padding: "10px",
            borderRadius: "50%",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
            transition: "transform 0.2s, background 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.background = "rgba(248, 91, 26, 0.9)"; // Orange DBZ color
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.background = "rgba(0, 0, 0, 0.7)";
          }}
        >
          {/* SVG icon for fullscreen toggle */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {isFullscreen ? (
              // Exit fullscreen icon
              <>
                <path d="M8 3v3a2 2 0 0 1-2 2H3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 16h3a2 2 0 0 1 2 2v3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </>
            ) : (
              // Enter fullscreen icon
              <>
                <path d="M8 3H5a2 2 0 0 0-2 2v3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 16v3a2 2 0 0 0 2 2h3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </>
            )}
          </svg>
        </div>
      </div>

      <main className={styles.main} style={isFullscreen ? { 
        height: '100vh', 
        width: '100vw',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative' // Needed for absolute positioning of canvas
      } : {}}>
        
        {/* Start Screen - shown when user hasn't started yet */}
        {!hasStarted && (
          <div style={{
            background: "rgba(255, 255, 255, 0.22)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderRadius: "24px",
            border: "1.5px solid rgba(255, 255, 255, 0.35)",
            padding: "2rem",
            margin: "auto",
            maxWidth: "600px",
            width: "90%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center"
          }}>
            <h1 style={{
              fontSize: '2.5rem',
              color: '#F85B1A',
              margin: '0 0 1.5rem 0',
              textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
              letterSpacing: '2px',
              textTransform: 'uppercase'
            }}>
              Formation Kamehameha
            </h1>
            
            <div style={{
              backgroundColor: 'rgba(248, 91, 26, 0.1)',
              border: '2px solid #F85B1A',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '2rem',
              width: '100%'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                color: '#F85B1A',
                margin: '0 0 1rem 0',
                textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000'
              }}>
                Voici comment faire un Kamehameha
              </h2>
              
              <div style={{
                textAlign: 'left',
                fontSize: '1.1rem',
                lineHeight: '1.6',
                color: '#263238'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                  <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>🙏</span>
                  <span>Imaginez une boule d&apos;énergie dans vos mains, paumes face à face.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                  <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>⚡</span>
                  <span>Ne vous en faites pas, elle va apparaître, chargez autant de temps que nécessaire</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>💥</span>
                  <span>Ouvrez vos doigts, déployant ainsi toute la puissance de votre Kamehameha</span>
                </div>
              </div>
            </div>

            {/* Walkthrough Checkbox */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1.5rem',
              fontSize: '1.1rem',
              color: '#263238'
            }}>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStart}
              style={{
                background: 'linear-gradient(90deg, #F85B1A 0%, #FF8A50 100%)',
                color: '#fff',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                padding: '1rem 2rem',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 24px 0 rgba(248, 91, 26, 0.4)',
                textShadow: '2px 2px 0 #000',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'all 0.3s ease',
                transform: 'skew(-5deg)'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'linear-gradient(90deg, #FF8A50 0%, #F85B1A 100%)';
                e.currentTarget.style.transform = 'skew(-5deg) scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 32px 0 rgba(248, 91, 26, 0.6)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'linear-gradient(90deg, #F85B1A 0%, #FF8A50 100%)';
                e.currentTarget.style.transform = 'skew(-5deg) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 24px 0 rgba(248, 91, 26, 0.4)';
              }}
            >
              Commencer l&apos;entraînement
            </button>
          </div>
        )}

        {/* Walkthrough - shown when hasStarted is true but walkthrough is enabled */}
        {hasStarted && showWalkthrough }

        {error && (
          <div style={{ color: "red", marginBottom: "1rem" }}>
            Error: {error}
          </div>
        )}

        {isLoading && hasStarted && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.22)",
              boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              borderRadius: "24px",
              border: "1.5px solid rgba(255, 255, 255, 0.35)",
              padding: "1rem",
              margin: "auto",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",

            }}
          >
            <Image
              src="/goku-dragon-ball.gif"
              alt="Chargement du modèle de détection des mains..."
              width={340}
              height={340}
            />
            <span style={{
              color: '#F85B1A', /* Orange color like in DBZ */
              textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
              fontSize: '2rem',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              transform: 'skew(-5deg)',
              display: 'inline-block'
            }}>
              CHARGEMENT...
            </span>
          </div>
        )}

        {!isLoading && !error && hasStarted && (
          <>
            {getGestureStatusText() && !isFullscreen && (
              <div
                style={{
                  marginBottom: "1rem",
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                }}
              >
                <code
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "rgba(0, 0, 0, 0.1)",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  {getGestureStatusText()}
                </code>
              </div>
            )}
            {getGestureInstructions()}
          </>
        )}
        
        {/* Canvas Container with Life Bar */}
        {!isLoading && !error && hasStarted && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: isFullscreen ? '100vh' : 'calc(100vh - 200px)',
            width: '100%'
          }}>
            <div style={{
              position: 'relative',
              display: 'inline-block',
              width: 'fit-content',
              height: 'fit-content'
            }}>
              {/* Kamehameha Life Bar - positioned relative to canvas */}
              <KamehamehaLifeBar 
                gestureState={gestureState}
                chargingProgress={gestureData.chargingProgress || 0}
                firingProgress={gestureData.firingProgress || 0}
                kamehamehaCount={kamehamehaCount}
                isFullscreen={isFullscreen}
              />
              
              <canvas
              style={{
                transform: isFullscreen ? "translate(-50%, -50%) scaleX(-1)" : "scaleX(-1)", // Center using transform
                zIndex: 1,
                borderRadius: isFullscreen ? "0" : "1rem",
                boxShadow:
                  isKamehamehaMode && gestureState === "charging"
                    ? "0 0 30px rgba(100, 200, 255, 0.8)"
                    : isKamehamehaMode && gestureState === "firing"
                    ? "0 0 50px rgba(255, 100, 100, 0.8)"
                    : "0 3px 10px rgb(0 0 0)",
                maxWidth: isFullscreen ? "100vw" : "85vw", 
                maxHeight: isFullscreen ? "100vh" : "auto",
                width: isFullscreen ? "auto" : "auto", // Auto in fullscreen to allow for proper centering
                height: isFullscreen ? "auto" : "auto", // Auto in fullscreen to allow for proper centering
                objectFit: isFullscreen ? "contain" : "contain", // Changed to contain to maintain aspect ratio
                display: isLoading ? "none" : "block",
                border: isFullscreen ? "none" : (isKamehamehaMode
                  ? "2px solid rgba(100, 200, 255, 0.5)"
                  : "none"),
                position: isFullscreen ? "absolute" : "relative",
                top: isFullscreen ? "50%" : "auto",
                left: isFullscreen ? "50%" : "auto",
              }}
              id="canvas"
            ></canvas>
            </div>
          </div>
        )}
        
        {!isLoading && !error && isFullscreen && gestureState === "firing" && hasStarted && (
          <div style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            pointerEvents: "none"
          }}>
            <div style={{
              color: '#F85B1A',
              textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
              fontSize: '3rem',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              transform: 'skew(-5deg)',
              display: 'inline-block',
              fontWeight: 'bold',
              animation: 'pulse 0.5s infinite alternate'
            }}>
              KAMEHAMEHA!
            </div>
            <style jsx>{`
              @keyframes pulse {
                from { transform: scale(1) skew(-5deg); }
                to { transform: scale(1.1) skew(-5deg); }
              }
            `}</style>
          </div>
        )}
        <video
          style={{
            visibility: "hidden",
            transform: "scaleX(-1)",
            position: "absolute",
            top: 0,
            left: 0,
            width: 0,
            height: 0,
          }}
          id="video"
          playsInline
        ></video>
      </main>
    </div>
  );
}
