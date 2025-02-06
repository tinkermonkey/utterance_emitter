/**
 * Configuration options for the Emitter class.
 */
export interface EmitterConfig {
  onUtterance?: (utterance: Utterance) => void; // Called when an utterance is detected
  volumeThreshold?: number; // The volume threshold at which to start recording
  preRecordingDuration?: number; // Number of milliseconds to keep in a buffer before the volume threshold is reached
  emitRawAudio?: boolean; // Whether to emit raw audio data
  emitMP3Audio?: boolean; // Whether to emit MP3 audio data
  emitText?: boolean; // Whether to emit text data
  sampleRate?: number; // The sample rate to use for audio recording
  mp3BitRate?: number; // The bit rate to use for MP3 encoding
  quietPeriod?: number; // Duration in milliseconds of below threshold audio to wait before stopping recording
  charts?:{
    width?: number;
    height?: number;
    barMargin?: number;
    barWidthNominal?: number;
    waveform?: HTMLCanvasElement;
    frequency?: HTMLCanvasElement;
    volume?: HTMLCanvasElement;
    threshold?: HTMLCanvasElement;
    speaking?: HTMLCanvasElement;
    foregroundColor?: string; // Color for the chart elements
    backgroundColor?: string; // Background color for the charts
    thresholdColor?: string; // Color for the threshold line
  }
}

export interface EmitterCanvas {
  width: number;
  height: number;
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/**
 * Types for the EventEmitter type and interface.
 */
export interface SpeakingEvent {
  speaking: boolean;
  timestamp: number;
}

export type EventCallback = (...args: any[]) => void;
export interface EventListeners {
  [event: string]: EventCallback[];
}

/**
 * Types of utterances that can be included in a single utterance emission (if enabled).
 */
export type RawAudioUtterance = Blob;
export type MP3AudioUtterance = Blob;
export type TextUtterance = string;

export interface UtteranceEvent {
  utterance: Utterance;
}

export type Utterance = {
  raw?: RawAudioUtterance;
  mp3?: MP3AudioUtterance;
  text?: TextUtterance;
  timestamp: number;
};
