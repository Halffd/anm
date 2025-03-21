export interface Token {
  surface_form: string
  basic_form?: string
  reading?: string
  pos?: string
  status?: 'new' | 'known' | 'mature'
  token?: {
    word_id?: number
    word_type?: string
    word_position?: number
    surface_form?: string
    pos?: string
  }
}

export interface Caption {
  id: string
  startTime: number
  endTime: number
  text: string
  tokens?: Token[]
  furigana?: Array<[string, string]>
  customOffset?: number
  lane?: number
}

export interface SubtitleTrack {
  id: string
  captions: Caption[]
  metadata: {
    language: string
    title: string
    format?: string
  }
}

export interface VideoInfo {
  url?: string
  title?: string
  duration?: number
  thumbnail?: string
  path?: string
} 