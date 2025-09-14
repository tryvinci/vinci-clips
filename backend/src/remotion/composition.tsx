import React from 'react';
import {
  Composition,
  getInputProps,
} from 'remotion';
import { CaptionedVideo } from './CaptionedVideo';

export const RemotionRoot: React.FC = () => {
  const inputProps = getInputProps();
  
  return (
    <>
      <Composition
        id="CaptionedVideo"
        component={CaptionedVideo}
        durationInFrames={Math.ceil((inputProps?.duration || 30) * 30)} // 30 FPS
        fps={30}
        width={1080}
        height={1920} // 9:16 aspect ratio for social media
        defaultProps={inputProps}
      />
    </>
  );
};