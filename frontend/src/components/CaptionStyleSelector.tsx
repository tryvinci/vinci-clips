"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface CaptionStyle {
  name: string;
  description: string;
  preview: string;
}

interface CaptionStyleSelectorProps {
  styles: Record<string, CaptionStyle>;
  selectedStyle: string;
  onStyleSelect: (styleId: string) => void;
}

export const CaptionStyleSelector: React.FC<CaptionStyleSelectorProps> = ({
  styles,
  selectedStyle,
  onStyleSelect,
}) => {
  const styleEntries = Object.entries(styles);

  if (styleEntries.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400">
        Loading caption styles...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {styleEntries.map(([styleId, style]) => (
        <Card
          key={styleId}
          className={`cursor-pointer transition-all duration-200 hover:scale-105 relative ${
            selectedStyle === styleId
              ? 'bg-purple-900/50 border-purple-500'
              : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'
          }`}
          onClick={() => onStyleSelect(styleId)}
        >
          <CardContent className="p-4">
            {/* Selected Badge */}
            {selectedStyle === styleId && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-purple-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Selected
                </Badge>
              </div>
            )}

            {/* Style Preview */}
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
              {getStylePreview(styleId)}
            </div>

            {/* Style Info */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">{style.name}</h3>
              <p className="text-xs text-gray-400 line-clamp-2">
                {style.description}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Helper function to generate style previews
function getStylePreview(styleId: string) {
  const baseText = "Sample Caption Text";
  
  switch (styleId) {
    case 'modern':
      return (
        <div className="relative w-full h-full">
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-black/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
              <span className="text-white text-sm font-bold">{baseText}</span>
            </div>
          </div>
        </div>
      );

    case 'dynamic':
      return (
        <div className="relative w-full h-full">
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2 rounded-2xl border-2 border-white/30 shadow-lg">
              <span className="text-white text-sm font-bold">{baseText}</span>
            </div>
          </div>
        </div>
      );

    case 'elegant':
      return (
        <div className="relative w-full h-full">
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-white/95 px-6 py-3 rounded-lg border border-gray-200 shadow-md">
              <span className="text-gray-800 text-sm font-serif">{baseText}</span>
            </div>
          </div>
        </div>
      );

    case 'playful':
      return (
        <div className="relative w-full h-full">
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div 
              className="bg-gradient-to-r from-yellow-400 to-green-400 px-4 py-2 rounded-3xl border-3 border-white shadow-lg transform rotate-1"
            >
              <span className="text-gray-800 text-sm font-bold">{baseText}</span>
            </div>
          </div>
        </div>
      );

    case 'minimalist':
      return (
        <div className="relative w-full h-full">
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-black/70 px-3 py-1 rounded">
              <span className="text-white text-sm">{baseText}</span>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="relative w-full h-full">
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <span className="text-white text-sm">{baseText}</span>
            </div>
          </div>
        </div>
      );
  }
}