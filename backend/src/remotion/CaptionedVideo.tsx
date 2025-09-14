import React from 'react';
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

interface Word {
  text: string;
  start: number;
  end: number;
  speaker: string;
}

interface CaptionSettings {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  position: 'top' | 'center' | 'bottom';
}

interface CaptionedVideoProps {
  videoUrl: string;
  words: Word[];
  style: string;
  settings: CaptionSettings;
  duration: number;
  startTime: number;
  endTime: number;
}

export const CaptionedVideo: React.FC<CaptionedVideoProps> = ({
  videoUrl,
  words,
  style,
  settings,
  duration,
  startTime = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Find the current words that should be displayed
  const currentWords = words.filter((word) => {
    const adjustedStart = word.start - startTime;
    const adjustedEnd = word.end - startTime;
    return currentTime >= adjustedStart && currentTime <= adjustedEnd;
  });

  // Group words into phrases for better readability
  const currentText = currentWords.map(word => word.text).join(' ');

  const renderCaption = () => {
    if (!currentText) return null;

    const baseStyle = getStyleForType(style, settings);
    
    return (
      <div style={baseStyle.container}>
        {style === 'dynamic' ? (
          <AnimatedText text={currentText} style={baseStyle.text} frame={frame} />
        ) : (
          <div style={baseStyle.text}>{currentText}</div>
        )}
      </div>
    );
  };

  return (
    <AbsoluteFill>
      {/* Background Video */}
      <Video
        src={videoUrl}
        startFrom={Math.floor(startTime * fps)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      
      {/* Caption Overlay */}
      {renderCaption()}
    </AbsoluteFill>
  );
};

const AnimatedText: React.FC<{
  text: string;
  style: React.CSSProperties;
  frame: number;
}> = ({ text, style, frame }) => {
  const words = text.split(' ');
  
  return (
    <div style={style}>
      {words.map((word, index) => {
        const delay = index * 3; // Stagger animation by 3 frames per word
        const progress = spring({
          frame: frame - delay,
          fps: 30,
          config: {
            damping: 12,
            stiffness: 100,
          },
        });

        const scale = interpolate(progress, [0, 1], [0.8, 1]);
        const opacity = interpolate(progress, [0, 1], [0, 1]);

        return (
          <span
            key={index}
            style={{
              display: 'inline-block',
              marginRight: '0.3em',
              transform: `scale(${scale})`,
              opacity,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

function getStyleForType(styleType: string, settings: CaptionSettings) {
  const baseContainer: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '0 40px',
    zIndex: 10,
  };

  const baseText: React.CSSProperties = {
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    color: settings.color,
    textAlign: 'center',
    fontWeight: 'bold',
    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
    lineHeight: 1.2,
    maxWidth: '90%',
  };

  // Position the caption
  if (settings.position === 'top') {
    baseContainer.top = '10%';
  } else if (settings.position === 'center') {
    baseContainer.top = '50%';
    baseContainer.transform = 'translateY(-50%)';
  } else {
    baseContainer.bottom = '15%';
  }

  switch (styleType) {
    case 'modern':
      return {
        container: {
          ...baseContainer,
        },
        text: {
          ...baseText,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))',
          padding: '12px 24px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
        },
      };

    case 'dynamic':
      return {
        container: {
          ...baseContainer,
        },
        text: {
          ...baseText,
          background: 'linear-gradient(45deg, #FF6B9D, #C44569)',
          padding: '16px 32px',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(196, 69, 105, 0.3)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
        },
      };

    case 'elegant':
      return {
        container: {
          ...baseContainer,
        },
        text: {
          ...baseText,
          fontFamily: 'Georgia, serif',
          background: 'rgba(255, 255, 255, 0.95)',
          color: '#2C3E50',
          padding: '20px 40px',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          border: '1px solid rgba(0,0,0,0.1)',
        },
      };

    case 'playful':
      return {
        container: {
          ...baseContainer,
        },
        text: {
          ...baseText,
          background: 'linear-gradient(45deg, #FFD93D, #6BCF7F)',
          color: '#2C3E50',
          padding: '18px 36px',
          borderRadius: '25px',
          boxShadow: '0 6px 25px rgba(255, 217, 61, 0.4)',
          border: '3px solid #FFFFFF',
          transform: 'rotate(-1deg)',
        },
      };

    case 'minimalist':
      return {
        container: {
          ...baseContainer,
        },
        text: {
          ...baseText,
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 16px',
          borderRadius: '4px',
          fontWeight: 'normal',
        },
      };

    default:
      return {
        container: baseContainer,
        text: {
          ...baseText,
          background: settings.backgroundColor,
          padding: '12px 24px',
          borderRadius: '8px',
        },
      };
  }
}