interface SubtitleLine {
  startTime: number;
  endTime: number;
  text: string;
  alignment?: 'left' | 'center' | 'right';
  style?: string;
}

// Parse ASS/SSA subtitle format
export function parseAss(content: string): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  const contentLines = content.split('\n');
  let inEvents = false;
  let formatLine: string[] = [];

  for (const line of contentLines) {
    if (line.startsWith('[Events]')) {
      inEvents = true;
      continue;
    }

    if (inEvents && line.startsWith('Format:')) {
      formatLine = line.substring(7).split(',').map(s => s.trim());
      continue;
    }

    if (inEvents && line.startsWith('Dialogue:')) {
      const parts = line.substring(9).split(',');
      
      // Need at least 10 parts for a valid dialogue line
      if (parts.length < 10) continue;
      
      // Find text index based on format
      const textIndex = formatLine.indexOf('Text');
      const styleIndex = formatLine.indexOf('Style');
      
      // Parse start and end times
      const startTime = timeToSeconds(parts[1].trim());
      const endTime = timeToSeconds(parts[2].trim());
      
      // Get style and text
      const style = styleIndex >= 0 && styleIndex < parts.length ? parts[styleIndex] : '';
      let text = parts.slice(Math.max(9, textIndex)).join(',').trim();
      
      // Determine alignment from style or override tags
      let alignment: 'left' | 'center' | 'right' = 'center';
      if (text.includes('\\an1') || text.includes('\\an4') || text.includes('\\an7')) {
        alignment = 'left';
      } else if (text.includes('\\an3') || text.includes('\\an6') || text.includes('\\an9')) {
        alignment = 'right';
      }
      
      lines.push({
        startTime,
        endTime,
        text,
        alignment,
        style
      });
    }
  }

  return lines;
}

// Parse SRT subtitle format
export function parseSrt(content: string): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  const blocks = content.split(/\n\s*\n/);

  for (const block of blocks) {
    const blockLines = block.trim().split('\n');
    if (blockLines.length < 3) continue;

    // Parse timecode
    const timecode = blockLines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timecode) continue;

    const startTime = timeToSeconds(timecode[1].replace(',', '.'));
    const endTime = timeToSeconds(timecode[2].replace(',', '.'));
    const text = blockLines.slice(2).join('\n');

    lines.push({
      startTime,
      endTime,
      text,
      alignment: 'center'
    });
  }

  return lines;
}

// Parse WebVTT subtitle format
export function parseVtt(content: string): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  const blocks = content.split(/\n\s*\n/).slice(1); // Skip WEBVTT header

  for (const block of blocks) {
    const blockLines = block.trim().split('\n');
    if (blockLines.length < 2) continue;

    // Find the line with the timecode
    const timecodeLine = blockLines.find(line => line.includes('-->'));
    if (!timecodeLine) continue;

    const timecode = timecodeLine.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (!timecode) continue;

    const startTime = timeToSeconds(timecode[1]);
    const endTime = timeToSeconds(timecode[2]);
    
    // Get alignment from cue settings
    let alignment: 'left' | 'center' | 'right' = 'center';
    if (timecodeLine.includes('align:start') || timecodeLine.includes('position:0%')) {
      alignment = 'left';
    } else if (timecodeLine.includes('align:end') || timecodeLine.includes('position:100%')) {
      alignment = 'right';
    }
    
    // Get text, excluding the timecode line and cue identifier
    const text = blockLines
      .filter(line => line !== timecodeLine && !line.match(/^\d+$/))
      .join('\n');

    lines.push({
      startTime,
      endTime,
      text,
      alignment
    });
  }

  return lines;
}

// Helper function to convert time string to seconds
function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  const seconds = parseFloat(parts[2]);
  const minutes = parseInt(parts[1]);
  const hours = parseInt(parts[0]);
  
  return hours * 3600 + minutes * 60 + seconds;
} 