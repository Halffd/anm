import { parseAss, parseSrt, parseVtt } from './subtitleParsers';

interface SubtitleTrack {
  src: string;
  language: string;
  label?: string;
  format: 'ass' | 'srt' | 'vtt';
  delay?: number;
}

/**
 * Load subtitle file and convert to blob URL
 */
export async function loadSubtitleFile(file: File): Promise<SubtitleTrack> {
  const content = await file.text();
  const format = getSubtitleFormat(file.name);
  
  // Create a blob URL for the subtitle content
  const blob = new Blob([content], { type: getContentType(format) });
  const url = URL.createObjectURL(blob);
  
  // Extract language from filename
  const language = extractLanguageFromFilename(file.name);
  
  return {
    src: url,
    language,
    label: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
    format
  };
}

/**
 * Determine subtitle format from filename
 */
function getSubtitleFormat(filename: string): 'ass' | 'srt' | 'vtt' {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  if (extension === 'ass' || extension === 'ssa') {
    return 'ass';
  } else if (extension === 'vtt') {
    return 'vtt';
  } else {
    return 'srt'; // Default to SRT
  }
}

/**
 * Get content type based on format
 */
function getContentType(format: string): string {
  switch (format) {
    case 'vtt':
      return 'text/vtt';
    case 'srt':
      return 'application/x-subrip';
    case 'ass':
      return 'text/plain';
    default:
      return 'text/plain';
  }
}

/**
 * Extract language code from filename
 * Supports patterns like: movie.en.srt, movie_en.srt, movie[en].srt
 */
function extractLanguageFromFilename(filename: string): string {
  // Try to extract language code
  const langMatch = filename.match(/[._\[\(]([a-z]{2,3})[\]\)_\.]/i);
  
  if (langMatch && langMatch[1]) {
    const lang = langMatch[1].toLowerCase();
    
    // Map common language codes
    const langMap: Record<string, string> = {
      'en': 'English',
      'jp': 'Japanese',
      'jpn': 'Japanese',
      'ja': 'Japanese',
      'fr': 'French',
      'de': 'German',
      'es': 'Spanish',
      'it': 'Italian',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ko': 'Korean'
    };
    
    return langMap[lang] || lang;
  }
  
  return 'Unknown';
} 