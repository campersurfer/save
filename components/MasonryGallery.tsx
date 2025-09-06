'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Download, Palette, Hash, Calendar, User, FileText } from 'lucide-react';
import Image from 'next/image';

interface SavedItem {
  id: string;
  type: 'article' | 'tweet' | 'image' | 'video' | 'instagram' | 'tiktok';
  url: string;
  title?: string;
  author?: string;
  content?: string;
  thumbnail?: string;
  dominantColor?: string;
  mood?: 'light' | 'dark' | 'warm' | 'cool' | 'neutral';
  temperature?: number;
  contrast?: number;
  saturation?: number;
  tags?: string[];
  savedAt: Date;
  viewCount?: number;
  duration?: number; // for videos
  mediaUrls?: string[]; // for multiple images
}

interface MasonryGalleryProps {
  items: SavedItem[];
  onItemClick?: (item: SavedItem) => void;
  onColorFilter?: (color: string) => void;
  onMoodFilter?: (mood: string) => void;
  columns?: number;
  gap?: number;
  animateOnScroll?: boolean;
}

const MasonryGallery: React.FC<MasonryGalleryProps> = ({
  items,
  onItemClick,
  onColorFilter,
  onMoodFilter,
  columns = 3,
  gap = 16,
  animateOnScroll = true
}) => {
  const [columnHeights, setColumnHeights] = useState<number[]>([]);
  const [arrangedItems, setArrangedItems] = useState<Array<SavedItem & { column: number; top: number }>>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate responsive columns based on screen width
  const getResponsiveColumns = useCallback(() => {
    if (typeof window === 'undefined') return columns;
    const width = window.innerWidth;
    if (width < 640) return 1;
    if (width < 1024) return 2;
    if (width < 1536) return Math.min(3, columns);
    return columns;
  }, [columns]);

  const [responsiveColumns, setResponsiveColumns] = useState(getResponsiveColumns());

  useEffect(() => {
    const handleResize = () => setResponsiveColumns(getResponsiveColumns());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getResponsiveColumns]);

  // Arrange items in masonry layout
  useEffect(() => {
    const heights = new Array(responsiveColumns).fill(0);
    const arranged = items.map(item => {
      // Find shortest column
      const shortestColumn = heights.indexOf(Math.min(...heights));
      const top = heights[shortestColumn];
      
      // Estimate item height based on content type
      let estimatedHeight = 200; // default
      if (item.type === 'article') estimatedHeight = 250;
      else if (item.type === 'tweet') estimatedHeight = 180;
      else if (item.type === 'image') estimatedHeight = 300;
      else if (item.type === 'video') estimatedHeight = 280;
      else if (item.type === 'instagram' && item.mediaUrls && item.mediaUrls.length > 1) {
        estimatedHeight = 350; // carousel
      }
      
      heights[shortestColumn] += estimatedHeight + gap;
      
      return {
        ...item,
        column: shortestColumn,
        top
      };
    });

    setColumnHeights(heights);
    setArrangedItems(arranged);
  }, [items, responsiveColumns, gap]);

  // Intersection Observer for lazy loading and animations
  useEffect(() => {
    if (!animateOnScroll) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisibleItems(prev => new Set([...prev, entry.target.id]));
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = containerRef.current?.querySelectorAll('.masonry-item');
    elements?.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [arrangedItems, animateOnScroll]);

  // Get item-specific styles based on mood and color
  const getItemStyle = (item: SavedItem) => {
    const baseStyle: React.CSSProperties = {
      backgroundColor: item.dominantColor || '#1a1a1c',
      borderRadius: '8px',
      overflow: 'hidden'
    };

    if (item.mood === 'warm') {
      baseStyle.boxShadow = '0 4px 20px rgba(255, 215, 0, 0.15)';
    } else if (item.mood === 'cool') {
      baseStyle.boxShadow = '0 4px 20px rgba(0, 102, 255, 0.15)';
    }

    return baseStyle;
  };

  // Render different content types
  const renderContent = (item: SavedItem) => {
    switch (item.type) {
      case 'article':
        return (
          <div className="p-4 space-y-2">
            <h3 className="font-semibold text-white line-clamp-2">{item.title}</h3>
            {item.author && (
              <p className="text-sm text-gray-400 flex items-center gap-1">
                <User className="h-3 w-3" />
                {item.author}
              </p>
            )}
            {item.content && (
              <p className="text-sm text-gray-300 line-clamp-3">{item.content}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FileText className="h-3 w-3" />
              <span>Article</span>
              {item.duration && <span>• {Math.ceil(item.duration / 60)} min read</span>}
            </div>
          </div>
        );

      case 'tweet':
        return (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-600" />
              <span className="text-sm font-medium text-white">{item.author || 'Twitter User'}</span>
            </div>
            <p className="text-sm text-gray-200">{item.content}</p>
            {item.mediaUrls && item.mediaUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-1">
                {item.mediaUrls.slice(0, 4).map((url, idx) => (
                  <div key={idx} className="aspect-square bg-gray-700 rounded" />
                ))}
              </div>
            )}
          </div>
        );

      case 'image':
        return (
          <>
            {item.thumbnail && (
              <div className="relative aspect-[4/3]">
                <Image
                  src={item.thumbnail}
                  alt={item.title || 'Saved image'}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            {item.title && (
              <div className="p-3">
                <p className="text-sm text-white">{item.title}</p>
              </div>
            )}
          </>
        );

      case 'video':
        return (
          <>
            {item.thumbnail && (
              <div className="relative aspect-video">
                <Image
                  src={item.thumbnail}
                  alt={item.title || 'Video thumbnail'}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-black/70 rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[12px] border-l-white border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1" />
                  </div>
                </div>
              </div>
            )}
            <div className="p-3">
              <p className="text-sm text-white">{item.title}</p>
              {item.duration && (
                <p className="text-xs text-gray-400 mt-1">
                  {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
                </p>
              )}
            </div>
          </>
        );

      case 'instagram':
        return (
          <div>
            {item.mediaUrls && item.mediaUrls.length > 0 && (
              <div className="relative aspect-square">
                <Image
                  src={item.mediaUrls[0]}
                  alt="Instagram post"
                  fill
                  className="object-cover"
                />
                {item.mediaUrls.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/60 rounded px-2 py-1">
                    <span className="text-xs text-white">1/{item.mediaUrls.length}</span>
                  </div>
                )}
              </div>
            )}
            <div className="p-3">
              <p className="text-sm text-white line-clamp-2">{item.content}</p>
              <p className="text-xs text-gray-400 mt-1">@{item.author}</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4">
            <p className="text-sm text-gray-400">{item.type}</p>
            <p className="text-white">{item.title || item.content}</p>
          </div>
        );
    }
  };

  return (
    <div ref={containerRef} className="relative" style={{ minHeight: Math.max(...columnHeights) }}>
      {arrangedItems.map((item, index) => {
        const columnWidth = `calc((100% - ${gap * (responsiveColumns - 1)}px) / ${responsiveColumns})`;
        const left = `calc(${item.column} * (100% / ${responsiveColumns}) + ${item.column * gap}px)`;
        
        return (
          <motion.div
            key={item.id}
            id={item.id}
            className="masonry-item absolute cursor-pointer transition-transform hover:scale-[1.02]"
            style={{
              width: columnWidth,
              left,
              top: item.top
            }}
            initial={animateOnScroll ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
            animate={
              !animateOnScroll || visibleItems.has(item.id)
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 20 }
            }
            transition={{ duration: 0.4, delay: index * 0.05 }}
            onClick={() => onItemClick?.(item)}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <div style={getItemStyle(item)} className="relative group">
              {renderContent(item)}
              
              {/* Overlay on hover */}
              <AnimatePresence>
                {hoveredItem === item.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4"
                  >
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-3">
                        <button className="hover:scale-110 transition-transform">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="hover:scale-110 transition-transform">
                          <Download className="h-4 w-4" />
                        </button>
                        {item.dominantColor && (
                          <button 
                            className="hover:scale-110 transition-transform"
                            onClick={(e) => {
                              e.stopPropagation();
                              onColorFilter?.(item.dominantColor!);
                            }}
                          >
                            <Palette className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {item.viewCount && (
                        <span className="text-xs">{item.viewCount} views</span>
                      )}
                    </div>
                    
                    {/* Color and mood badges */}
                    {(item.mood || item.tags) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.mood && (
                          <span
                            className="px-2 py-1 bg-white/20 rounded text-xs cursor-pointer hover:bg-white/30"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoodFilter?.(item.mood!);
                            }}
                          >
                            {item.mood}
                          </span>
                        )}
                        {item.tags?.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-1 bg-white/10 rounded text-xs">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default MasonryGallery;