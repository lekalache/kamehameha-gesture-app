import { useEffect, useState } from 'react';

const KamehamehaLifeBar = ({ 
  gestureState = 'idle', 
  chargingProgress = 0, 
  firingProgress = 0, 
  kamehamehaCount = 0,
  isFullscreen = false 
}) => {
  const [isReady, setIsReady] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // Calculate bar fill percentage based on gesture state
  const getBarFillPercentage = () => {
    switch (gestureState) {
      case 'charging':
        return chargingProgress * 100;
      case 'firing':
        // During firing, show decreasing progress (bar empties)
        return (1 - firingProgress) * 100;
      case 'idle':
      case 'positioning':
      default:
        return 0;
    }
  };

  const barFillPercentage = getBarFillPercentage();

  // Trigger ready animation when charging reaches 100%
  useEffect(() => {
    if (gestureState === 'charging' && chargingProgress >= 1.0) {
      setIsReady(true);
      setPulseAnimation(true);
    } else if (gestureState === 'firing') {
      setIsReady(false);
      setPulseAnimation(false);
    } else if (gestureState === 'idle' || gestureState === 'positioning') {
      setIsReady(false);
      setPulseAnimation(false);
    }
  }, [gestureState, chargingProgress]);

  // Create segmented bar (8 segments like classic DBZ)
  const segmentCount = 8;
  const filledSegments = Math.floor((barFillPercentage / 100) * segmentCount);
  
  return (
    <div 
      className="kamehameha-lifebar"
      style={{
        position: isFullscreen ? 'fixed' : 'absolute',
        top: isFullscreen ? '30px' : '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'auto',
        maxWidth: isFullscreen ? '90vw' : 'auto',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: isFullscreen ? '16px' : '12px',
        padding: isFullscreen ? '12px 24px' : '8px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '25px',
        backdropFilter: 'blur(5px)',
        border: '2px solid #F85B1A',
        boxShadow: '0 4px 15px rgba(248, 91, 26, 0.4)',
        fontSize: isFullscreen ? '16px' : '14px',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Star Circle */}
      <div 
        className="star-circle"
        style={{
          width: isFullscreen ? '50px' : '40px',
          height: isFullscreen ? '50px' : '40px',
          backgroundColor: '#F85B1A',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '3px solid #FFD700',
          boxShadow: isReady 
            ? '0 0 20px #F85B1A, inset 0 0 20px rgba(255, 215, 0, 0.3)' 
            : '0 0 10px #F85B1A, inset 0 0 10px rgba(255, 215, 0, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          animation: pulseAnimation ? 'starPulse 0.8s infinite alternate' : 'none',
        }}
      >
        {/* Distressed texture overlay */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              radial-gradient(circle at 20% 30%, rgba(0,0,0,0.1) 2px, transparent 3px),
              radial-gradient(circle at 70% 20%, rgba(0,0,0,0.1) 1px, transparent 2px),
              radial-gradient(circle at 60% 80%, rgba(0,0,0,0.1) 1.5px, transparent 2px)
            `,
            borderRadius: '50%',
          }}
        />
        
        {/* Five-pointed star */}
        <svg 
          width={isFullscreen ? "28" : "22"} 
          height={isFullscreen ? "28" : "22"} 
          viewBox="0 0 24 24" 
          fill="none"
          style={{ 
            filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))',
            zIndex: 1 
          }}
        >
          <path 
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
            fill="#FFD700" 
            stroke="#FFAA00" 
            strokeWidth="0.5"
          />
          {/* Inner star highlight */}
          <path 
            d="M12 4L14.5 9.5L20 10.3L16 14.2L17 19.7L12 17L7 19.7L8 14.2L4 10.3L9.5 9.5L12 4Z" 
            fill="#FFEE88" 
            opacity="0.7"
          />
        </svg>
      </div>

      {/* Segmented Energy Bar */}
      <div 
        className="energy-bar"
        style={{
          display: 'flex',
          gap: '2px',
          alignItems: 'center',
        }}
      >
        {Array.from({ length: segmentCount }, (_, index) => {
          const isFilled = index < filledSegments;
          const isPartiallyFilled = index === filledSegments && (barFillPercentage % (100 / segmentCount)) > 0;
          const partialFillPercent = isPartiallyFilled ? ((barFillPercentage % (100 / segmentCount)) / (100 / segmentCount)) * 100 : 0;
          
          return (
            <div
              key={index}
              className="energy-segment"
              style={{
                width: isFullscreen ? '20px' : '16px',
                height: isFullscreen ? '12px' : '10px',
                backgroundColor: '#2A2A2A',
                border: '1px solid #F85B1A',
                borderRadius: '2px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              {/* Filled portion */}
              {(isFilled || isPartiallyFilled) && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: isFilled ? '100%' : `${partialFillPercent}%`,
                    height: '100%',
                    background: gestureState === 'charging'
                      ? 'linear-gradient(90deg, #FF6B00, #F85B1A, #FFD700)'
                      : gestureState === 'firing'
                      ? 'linear-gradient(90deg, #FF0000, #FF6B00, #FFD700)'
                      : '#F85B1A',
                    borderRadius: '1px',
                    boxShadow: isReady 
                      ? '0 0 8px #FFD700, inset 0 1px 2px rgba(255,255,255,0.3)' 
                      : '0 0 4px #F85B1A, inset 0 1px 2px rgba(255,255,255,0.3)',
                    animation: isReady ? 'segmentGlow 1s infinite alternate' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Kamehameha Counter Badge */}
      <div 
        className="counter-badge"
        style={{
          minWidth: isFullscreen ? '32px' : '26px',
          height: isFullscreen ? '32px' : '26px',
          backgroundColor: '#F85B1A',
          border: '2px solid #FFD700',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: isFullscreen ? '14px' : '12px',
          textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
          boxShadow: '0 0 8px rgba(248, 91, 26, 0.5), inset 0 1px 3px rgba(255,255,255,0.2)',
          position: 'relative',
        }}
      >
        {kamehamehaCount}
        
        {/* Shine effect */}
        <div 
          style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            width: '8px',
            height: '8px',
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderRadius: '50%',
            filter: 'blur(1px)',
          }}
        />
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes starPulse {
          0% { 
            transform: scale(1); 
            box-shadow: 0 0 20px #F85B1A, inset 0 0 20px rgba(255, 215, 0, 0.3);
          }
          100% { 
            transform: scale(1.1); 
            box-shadow: 0 0 30px #FFD700, inset 0 0 30px rgba(255, 215, 0, 0.5);
          }
        }
        
        @keyframes segmentGlow {
          0% { 
            box-shadow: 0 0 8px #FFD700, inset 0 1px 2px rgba(255,255,255,0.3);
          }
          100% { 
            box-shadow: 0 0 15px #FFD700, inset 0 1px 3px rgba(255,255,255,0.5);
          }
        }
        
        .kamehameha-lifebar:hover {
          transform: translateX(-50%) scale(1.02);
        }
        
        .energy-segment {
          transition: all 0.2s ease;
        }
        
        .energy-segment:hover {
          border-color: #FFD700;
        }
      `}</style>
    </div>
  );
};

export default KamehamehaLifeBar;
