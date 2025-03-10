import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Caption } from '~/types'
import { makeFurigana } from '~/server/services/tokenizer'
import { useFurigana } from '~/composables/useFurigana'

export const useCaptionsStore = defineStore('captions', () => {
  const captions = ref<Caption[]>([])
  const activeCaptionIds = ref<string[]>([])
  const isOffsetMode = ref(false)
  const isAutoPauseMode = ref(false)
  const lastPauseTime = ref<number | null>(null)
  const currentTime = ref(0)
  const showSubtitles = ref(true)
  const isSidebarVisible = ref(true)

  const activeCaptions = computed(() => {
    return captions.value.filter(caption => 
      activeCaptionIds.value.includes(caption.id)
    )
  })

  function parseSRT(content: string): Caption[] {
    const entries = content.trim().split(/\n\s*\n/).map(block => {
      const lines = block.trim().split('\n')
      if (lines.length < 3) return null

      const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/)
      if (!timeMatch) return null

      const startTime = timeToSeconds(timeMatch[1])
      const endTime = timeToSeconds(timeMatch[2])
      const text = lines.slice(2).join('\n')

      return {
        id: generateId(),
        startTime,
        endTime,
        text,
        isActive: false
      } as Caption
    })

    return entries.filter((entry): entry is Caption => entry !== null)
  }

  function parseASS(content: string): Caption[] | null {
    const lines = content.split('\n')
    const events = lines.filter(line => line.startsWith('Dialogue:'))
    if (!events.length) return null

    const captions = events.map(line => {
      const parts = line.split(',')
      if (parts.length < 10) return null

      const startTime = timeToSeconds(parts[1])
      const endTime = timeToSeconds(parts[2])
      const text = parts.slice(9).join(',').trim()
      const voice = parts[3] && parts[4] ? `${parts[3]} ${parts[4]}` : undefined

      return {
        id: generateId(),
        startTime,
        endTime,
        text,
        voice,
        isActive: false
      } as Caption
    })

    return captions.filter((entry): entry is Caption => entry !== null)
  }

  function parseVTT(content: string): Caption[] | null {
    if (!content.startsWith('WEBVTT')) return null

    const entries = content.split(/\n\s*\n/).slice(1).map(block => {
      const lines = block.trim().split('\n')
      if (lines.length < 2) return null

      const timeMatch = lines[0].match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/)
      if (!timeMatch) return null

      const startTime = timeToSeconds(timeMatch[1])
      const endTime = timeToSeconds(timeMatch[2])
      const text = lines.slice(1).join('\n')

      return {
        id: generateId(),
        startTime,
        endTime,
        text,
        isActive: false
      } as Caption
    })

    return entries.filter((entry): entry is Caption => entry !== null)
  }

  function parseCaptions(fileContent: string): Caption[] | null {
    // Try parsing as VTT first
    let parsed = parseVTT(fileContent)
    if (!parsed) {
      // Try ASS format
      parsed = parseASS(fileContent)
    }
    if (!parsed) {
      // Try SRT format
      parsed = parseSRT(fileContent)
    }
    
    if (!parsed) return null

    // Sort and process captions
    sortCaptionsByTime(parsed)
    mergeDuplicates(parsed)
    assignCaptionsToLanes(parsed)

    return parsed
  }

  function timeToSeconds(timeStr: string): number {
    const [time, ms] = timeStr.split(/[,.]/)
    const [hours, minutes, seconds] = time.split(':').map(Number)
    return hours * 3600 + minutes * 60 + seconds + Number(ms) / 1000
  }

  function generateId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  function sortCaptionsByTime(captions: Caption[]) {
    captions.sort((a, b) => {
      if (a.startTime === b.startTime) {
        return a.endTime > b.endTime ? 1 : -1
      }
      return a.startTime > b.startTime ? 1 : -1
    })
  }

  function mergeDuplicates(captions: Caption[]) {
    const duplicateIndexes: number[] = []
    
    for (let i = 0; i < captions.length - 1; i++) {
      const caption = captions[i]
      const nextCaption = captions[i + 1]
      
      if (caption.text === nextCaption.text && isOverlapping(caption, nextCaption)) {
        nextCaption.startTime = Math.min(caption.startTime, nextCaption.startTime)
        nextCaption.endTime = Math.max(caption.endTime, nextCaption.endTime)
        duplicateIndexes.push(i)
      }
    }

    // Remove duplicates from end to start to avoid index shifting
    for (let i = duplicateIndexes.length - 1; i >= 0; i--) {
      captions.splice(duplicateIndexes[i], 1)
    }
  }

  function isOverlapping(left: Caption, right: Caption): boolean {
    const containedDuration = right.endTime - left.startTime
    const rightDuration = right.endTime - right.startTime
    return containedDuration > 0.2 || (containedDuration / rightDuration) > 0.3
  }

  async function loadCaptions(fileContent: string) {
    const parsed = parseCaptions(fileContent)
    if (!parsed) return

    const { processFurigana } = useFurigana()

    // Process furigana for each caption
    for (const caption of parsed) {
      const furigana = await processFurigana(caption.text)
      if (furigana) {
        caption.furigana = furigana
      }
    }

    captions.value = parsed
  }

  function setCurrentTime(time: number) {
    currentTime.value = time
    updateActiveCaptions()
  }

  function updateActiveCaptions() {
    const active = captions.value.filter(caption => 
      caption.startTime <= currentTime.value && 
      currentTime.value <= caption.endTime
    )
    activeCaptionIds.value = active.map(c => c.id)
  }

  function previousCaption() {
    const currentCaption = activeCaptions.value[0]
    if (!currentCaption) return
    
    const index = captions.value.findIndex(c => c.id === currentCaption.id)
    if (index > 0) {
      playCaption(captions.value[index - 1])
    }
  }

  function nextCaption() {
    const currentCaption = activeCaptions.value[activeCaptions.value.length - 1]
    if (!currentCaption) return
    
    const index = captions.value.findIndex(c => c.id === currentCaption.id)
    if (index < captions.value.length - 1) {
      playCaption(captions.value[index + 1])
    }
  }

  function playCaption(caption: Caption) {
    setCurrentTime(caption.startTime + 0.0001)
    activeCaptionIds.value = [caption.id]
  }

  function toggleAutoPause() {
    isAutoPauseMode.value = !isAutoPauseMode.value
    lastPauseTime.value = currentTime.value
  }

  function toggleSubtitles() {
    showSubtitles.value = !showSubtitles.value
  }

  function toggleSidebar() {
    isSidebarVisible.value = !isSidebarVisible.value
  }

  function toggleOffsetMode() {
    isOffsetMode.value = !isOffsetMode.value
  }

  function assignCaptionsToLanes(captions: Caption[]) {
    for (let i = 0; i < captions.length; i++) {
      const caption = captions[i]
      const previousCaptions = findPreviousCaptions(captions, i)

      // Find available lane
      const takenLanes = previousCaptions
        .filter(prev => isOverlapping(prev, caption))
        .map(c => c.lane)
        .filter((lane): lane is number => lane !== undefined)

      // Assign first available lane
      for (let lane = 0; lane < takenLanes.length + 1; lane++) {
        if (!takenLanes.includes(lane)) {
          caption.lane = lane
          break
        }
      }

      if (caption.lane === undefined) {
        caption.lane = 0
      }
    }
  }

  function findPreviousCaptions(captions: Caption[], currentIndex: number): Caption[] {
    const previousCaptions: Caption[] = []
    const previousLanes = new Set<number>()
    const maxLookBehind = 5
    let misses = 0

    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevCaption = captions[i]
      if (prevCaption.lane !== undefined && previousLanes.has(prevCaption.lane)) {
        misses++
        if (misses > maxLookBehind) break
        continue
      }

      previousCaptions.push(prevCaption)
      if (prevCaption.lane !== undefined) {
        previousLanes.add(prevCaption.lane)
      }
    }

    return previousCaptions.sort((a, b) => 
      (a.lane ?? 0) - (b.lane ?? 0)
    )
  }

  function downloadSubtitles() {
    if (!captions.value.length) return

    const srtContent = captions.value.map((caption, index) => {
      const startTime = formatSrtTime(caption.startTime)
      const endTime = formatSrtTime(caption.endTime)
      return `${index + 1}\n${startTime} --> ${endTime}\n${caption.text}\n`
    }).join('\n')

    const blob = new Blob([srtContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = 'subtitles.srt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function formatSrtTime(seconds: number): string {
    const pad = (n: number) => n.toString().padStart(2, '0')
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms)}`
  }

  return {
    captions,
    activeCaptionIds,
    activeCaptions,
    isOffsetMode,
    isAutoPauseMode,
    lastPauseTime,
    currentTime,
    showSubtitles,
    isSidebarVisible,
    loadCaptions,
    setCurrentTime,
    updateActiveCaptions,
    previousCaption,
    nextCaption,
    playCaption,
    toggleAutoPause,
    toggleSubtitles,
    toggleSidebar,
    toggleOffsetMode,
    assignCaptionsToLanes,
    findPreviousCaptions,
    downloadSubtitles,
    formatSrtTime
  }
}) 