import * as lamejs from "@breezystack/lamejs"
import {
  EmitterConfig,
  EmitterCanvas,
  Utterance,
  SpeakingEvent,
  UtteranceEvent,
} from "./types"
import { AudioAnalyser } from "./audio-analyser"
import { EventEmitter } from "./event-emitter"

const enablePreRecording = false
const preRecordingChunkDuration = 10 // Duration in milliseconds for each audio chunks

const DEFAULT_VOLUME_THRESHOLD = 7
const DEFAULT_SIGNAL_LENGTH = 100
const DEFAULT_QUET_PERIOD = 400
const DEFAULT_PRE_RECORDING_DURATION = 200
const DEFAULT_MP3_BITRATE = 128
const DEFAULT_SAMPLE_RATE = 44100
const DEFAULT_CHART_WIDTH = 400
const DEFAULT_CHART_HEIGHT = 200
const DEFAULT_CHART_FOREGROUND = "rgb(0 0 0)"
const DEFAULT_BACKGROUND_COLOR = "rgb(200 200 200)"
const DEFAULT_THRESHOLD_COLOR = "rgb(255 0 0)"
const DEFAULT_BAR_WIDTH = 2.5
const DEFAULT_BAR_MARGIN = 1
const CHART_SCALE = 255.0

export const defaultEmitterConfig: EmitterConfig = {
  volumeThreshold: DEFAULT_VOLUME_THRESHOLD,
  preRecordingDuration: DEFAULT_PRE_RECORDING_DURATION,
  emitRawAudio: false,
  emitMP3Audio: true,
  emitText: false,
  sampleRate: DEFAULT_SAMPLE_RATE,
  mp3BitRate: DEFAULT_MP3_BITRATE,
  quietPeriod: DEFAULT_QUET_PERIOD,
}

class UtteranceEmitter extends EventEmitter {
  config: EmitterConfig
  initialized: boolean = false

  // Audio interface elements
  audioContext?: AudioContext
  mediaRecorder?: MediaRecorder
  preRecordingMediaRecorder?: MediaRecorder

  // Audio processing state
  volumeThreshold: number = DEFAULT_VOLUME_THRESHOLD
  aboveThreshold: boolean = false
  belowThresholdDuration: number = 0

  // Audio signal data
  audioChunks: Float32Array[] = []
  preRecordingChunks: Float32Array[] = []

  // Processed signal data
  volumeData: number[] = []
  thresholdSignalData: number[] = []
  speakingSignalData: number[] = []
  maxSignalPoints: number = DEFAULT_SIGNAL_LENGTH
  analysers?: {
    waveform?: AudioAnalyser
    frequency?: AudioAnalyser
    volume: AudioAnalyser
  }
  
  // Chart elements
  canvases?: {
    waveform?: EmitterCanvas
    frequency?: EmitterCanvas
    volume?: EmitterCanvas
    threshold?: EmitterCanvas
    speaking?: EmitterCanvas
  }
  barWidth: number = DEFAULT_BAR_WIDTH
  barMargin: number = DEFAULT_BAR_MARGIN
  animationFrameId?: number

  /**
   * Create a new UtteranceEmitter with the provided configuration
   * @param config Configuration for the utterance emitter
   */
  constructor(config?: EmitterConfig) {
    super()
    // merge the passed config with the default config
    this.config = { ...defaultEmitterConfig, ...config }
    this.handleStream = this.handleStream.bind(this)
  }

  /**
   * Initialize the audio context and any charts that are configured
   * Doesn't start recording audio, doesn't need to be called before start()
   */
  init(): void {
    console.log("Initializing utterance emitter")

    // If there are charts configured, initialize them
    if (this.config.charts) {
      console.log("Initializing charts", this.config.charts)
      this.canvases = {
        waveform: this.config.charts.waveform
          ? this.initCanvas(this.config.charts.waveform)
          : undefined,
        frequency: this.config.charts.frequency
          ? this.initCanvas(this.config.charts.frequency)
          : undefined,
        volume: this.config.charts.volume
          ? this.initCanvas(this.config.charts.volume)
          : undefined,
        threshold: this.config.charts.threshold
          ? this.initCanvas(this.config.charts.threshold)
          : undefined,
        speaking: this.config.charts.speaking
          ? this.initCanvas(this.config.charts.speaking)
          : undefined,
      }
    }

    this.initialized = true
  }

  /**
   * Initialize a canvas for a chart
   */
  initCanvas(el: HTMLCanvasElement): EmitterCanvas {
    console.log("Initializing canvas", el)
    const ctx = el.getContext("2d") as CanvasRenderingContext2D
    const canvas: EmitterCanvas = {
      width: this.config.charts?.width || DEFAULT_CHART_WIDTH,
      height: this.config.charts?.height || DEFAULT_CHART_HEIGHT,
      el,
      ctx,
    }

    // Set the canvas size based on the parent element size
    el.width = canvas.width
    el.height = canvas.height

    return canvas
  }

  /**
   * Start recording audio from the microphone and emitting utterances
   */
  start(): void {
    console.log("Starting utterance emitter")
    if (!this.initialized) {
      this.init()
    }

    navigator.mediaDevices
      .getUserMedia({ audio: { sampleRate: this.config.sampleRate || DEFAULT_SAMPLE_RATE } })
      .then(this.handleStream)
      .catch(this.handleError)
  }

  /**
   * Setup the audio processing once there's a stream available
   */
  handleStream(stream: MediaStream): void {
    this.audioContext = new AudioContext()
    this.audioChunks = []

    // Create a source node from the stream
    const source = this.audioContext.createMediaStreamSource(stream)

    // Create analysers for the signals we're monitoring
    this.analysers = {
      volume: new AudioAnalyser(this.audioContext, source),
      waveform: this.config.charts?.waveform
        ? new AudioAnalyser(this.audioContext, source, 2048)
        : undefined,
      frequency: this.config.charts?.frequency
        ? new AudioAnalyser(this.audioContext, source, 2048)
        : undefined,
    }

    // Set the bar width on the charts and max data points
    if (this.config.charts) {
      const chartWidth = this.config.charts.width || DEFAULT_CHART_WIDTH
      this.barWidth =
        (chartWidth /
          (this.analysers.frequency?.bufferLength || DEFAULT_SIGNAL_LENGTH)) *
        (this.config.charts.barWidthNominal || DEFAULT_BAR_WIDTH)
      this.barMargin = this.config.charts.barMargin || DEFAULT_BAR_MARGIN

      this.maxSignalPoints = Math.ceil(
        chartWidth / (this.barWidth + this.barMargin)
      )
    }

    this.mediaRecorder = new MediaRecorder(stream)

    // Accumulate audio chunks as they come in
    this.mediaRecorder.ondataavailable = (event) => {
      // @ts-ignore
      this.audioChunks.push(event.data)
    }

    // Once the recording is signaled to stop because the filtered isSpeaking signal drops to zero, process the audio
    this.mediaRecorder.onstop = () => {
      this.processUtterance()
    }

    // Create a media recorder to capture the audio stream
    if (enablePreRecording) {
      // Create a second media recorder for the pre-recording buffer
      this.preRecordingMediaRecorder = new MediaRecorder(stream)
      this.preRecordingChunks = []

      // Keep some pre-recording buffer to better capture sharp rises in volume
      this.preRecordingMediaRecorder.ondataavailable = (event) => {
        // @ts-ignore
        this.preRecordingChunks.push(event.data)

        // Limit the pre-recording buffer to the pre-recording duration
        const preRecordingDuration =
          this.config.preRecordingDuration || DEFAULT_PRE_RECORDING_DURATION
        if (
          preRecordingDuration &&
          this.preRecordingChunks.length >
            preRecordingDuration / preRecordingChunkDuration
        ) {
          this.preRecordingChunks.shift()
        }

        // Start the pre-recording buffer recorder with a finite time slice
        this.preRecordingMediaRecorder?.start(preRecordingChunkDuration)
      }
    }

    this.processAudio()
    if (this.config.charts?.waveform) {
      this.drawWaveform()
    }
    if (this.config.charts?.frequency) {
      this.drawFrequency()
    }
    if (this.config.charts?.volume) {
      this.drawVolume()
    }
    if (this.config.charts?.threshold) {
      this.drawThresholdSignal()
    }
    if (this.config.charts?.speaking) {
      this.drawSpeakingSignal()
    }
  }

  /**
   * Process audio from the stream and monitor the volume, waveform, and frequency
   */
  processAudio(): void {
    console.log("Processing audio")
    if (!this.analysers) return
    const levelAnalyser = this.analysers.volume
    levelAnalyser.node.getByteFrequencyData(levelAnalyser.dataArray)

    // calculate the average volume
    let sum = 0
    for (let i = 0; i < levelAnalyser.bufferLength; i++) {
      sum += levelAnalyser.dataArray[i]
    }
    const average = sum / levelAnalyser.bufferLength

    // Store the average volume volume
    if (this.volumeData.length >= this.maxSignalPoints) {
      this.volumeData.shift()
    }
    this.volumeData.push(average)

    // Store the threshold signal
    const thresholdSignal = average > this.volumeThreshold ? 1 : 0
    if (this.thresholdSignalData.length >= this.maxSignalPoints) {
      this.thresholdSignalData.shift()
    }
    this.thresholdSignalData.push(thresholdSignal)

    // Calculate the speaking signal by filtering the threshold signal
    if (average > this.volumeThreshold) {
      this.aboveThreshold = true
      this.belowThresholdDuration = 0
    } else {
      this.belowThresholdDuration += 16.67 // Approximate duration of one frame at 60 FPS
      if (
        this.belowThresholdDuration >=
        (this.config.quietPeriod || DEFAULT_QUET_PERIOD)
      ) {
        this.aboveThreshold = false
      }
    }

    // Store the speaking signal
    const speakingSignal = this.aboveThreshold ? 1 : 0

    // If the speaking state has changed from 0 to 1, emit the speaking event
    if (
      speakingSignal === 1 &&
      this.speakingSignalData[this.speakingSignalData.length - 1] === 0
    ) {
      const event: SpeakingEvent = {
        speaking: true,
        timestamp: Date.now(),
      }
      this.emit("speaking", event)
    } else if (
      speakingSignal === 0 &&
      this.speakingSignalData[this.speakingSignalData.length - 1] === 1
    ) {
      const event: SpeakingEvent = {
        speaking: false,
        timestamp: Date.now(),
      }
      this.emit("speaking", event)
    }

    if (this.speakingSignalData.length >= this.maxSignalPoints) {
      this.speakingSignalData.shift()
    }
    this.speakingSignalData.push(speakingSignal)

    // Start or stop recording based on filtered signal
    if (speakingSignal && this.mediaRecorder?.state === "inactive") {
      console.log("Starting media recorder")
      this.mediaRecorder.start()
    } else if (!speakingSignal && this.mediaRecorder?.state === "recording") {
      console.log("Stopping media recorder")
      this.mediaRecorder.stop()
    }

    this.animationFrameId = requestAnimationFrame(this.processAudio.bind(this))
  }

  /**
   * Process any audio blob from the stream which has been captured
   */
  async processUtterance(): Promise<void> {
    console.log("Processing utterance")
    if (!this.audioContext) return

    const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" })

    // Clear the audio chunks
    this.audioChunks = []

    try {
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await new AudioContext().decodeAudioData(arrayBuffer)
      const mp3Blob = await UtteranceEmitter.encodeMP3(
        audioBuffer,
        this.config.mp3BitRate || DEFAULT_MP3_BITRATE
      )

      // Create the utterance
      const utterance = {
        timestamp: Date.now(),
      } as Utterance
      if (this.config.emitRawAudio) {
        utterance.raw = audioBlob
      }
      if (this.config.emitMP3Audio) {
        utterance.mp3 = mp3Blob
      }
      if (this.config.emitText) {
        utterance.text = "TODO: Implement speech-to-text"
      }

      // Create and emit the utterance event
      const utteranceEvent: UtteranceEvent = {
        utterance,
      }

      console.log("Emitting utterance event:", utteranceEvent)
      this.emit("utterance", utteranceEvent)
      if (this.config.onUtterance) {
        this.config.onUtterance(utterance)
      }
    } catch (error) {
      console.error("Error processing utterance:", error)
      throw error
    }
  }

  handleError(error: Error): void {
    console.error("Error accessing media stream:", error)
  }

  stop(): void {
    console.log("Stopping utterance emitter")

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = undefined
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = undefined
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }
    if (
      this.preRecordingMediaRecorder &&
      this.preRecordingMediaRecorder.state !== "inactive"
    ) {
      this.preRecordingMediaRecorder.stop()
    }
  }

  drawWaveform() {
    const drawVisual = requestAnimationFrame(this.drawWaveform.bind(this))
    const audioAnalyser = this.analysers?.waveform
    const emitterCanvas = this.canvases?.waveform
    const canvasCtx = emitterCanvas?.ctx
    if (!audioAnalyser) return
    if (!canvasCtx) return

    audioAnalyser.node.getByteTimeDomainData(audioAnalyser.dataArray)

    const backgroundColor =
      this.config.charts?.backgroundColor || DEFAULT_BACKGROUND_COLOR
    const foregroundColor =
      this.config.charts?.foregroundColor || DEFAULT_CHART_FOREGROUND
    const thresholdColor =
      this.config.charts?.thresholdColor || DEFAULT_THRESHOLD_COLOR
    canvasCtx.fillStyle = backgroundColor
    canvasCtx.fillRect(0, 0, emitterCanvas.width, emitterCanvas.height)

    canvasCtx.lineWidth = 2
    canvasCtx.strokeStyle = foregroundColor
    canvasCtx.beginPath()

    const sliceWidth = emitterCanvas.width / audioAnalyser.bufferLength
    let x = 0
    for (let i = 0; i < audioAnalyser.bufferLength; i++) {
      const v = audioAnalyser.dataArray[i] / 128.0
      const y = v * (emitterCanvas.height / 2)

      if (i === 0) {
        canvasCtx.moveTo(x, y)
      } else {
        canvasCtx.lineTo(x, y)
      }

      x += sliceWidth
    }

    canvasCtx.lineTo(emitterCanvas.width, emitterCanvas.height / 2)
    canvasCtx.stroke()

    // Draw the VOLUME_THRESHOLD bars
    canvasCtx.lineWidth = 1
    canvasCtx.strokeStyle = thresholdColor
    canvasCtx.beginPath()
    const thresholdYPositive =
      emitterCanvas.height / 2 -
      ((this.volumeThreshold / CHART_SCALE) * emitterCanvas.height) / 2
    const thresholdYNegative =
      emitterCanvas.height / 2 +
      ((this.volumeThreshold / CHART_SCALE) * emitterCanvas.height) / 2
    canvasCtx.moveTo(0, thresholdYPositive)
    canvasCtx.lineTo(emitterCanvas.width, thresholdYPositive)
    canvasCtx.moveTo(0, thresholdYNegative)
    canvasCtx.lineTo(emitterCanvas.width, thresholdYNegative)
    canvasCtx.stroke()
  }

  drawFrequency() {
    const drawVisual = requestAnimationFrame(this.drawFrequency.bind(this))
    const audioAnalyser = this.analysers?.frequency
    const emitterCanvas = this.canvases?.frequency
    const canvasCtx = emitterCanvas?.ctx
    if (!audioAnalyser) return
    if (!canvasCtx) return

    audioAnalyser.node.getByteFrequencyData(audioAnalyser.dataArray)

    const backgroundColor =
      this.config.charts?.backgroundColor || DEFAULT_BACKGROUND_COLOR
    const foregroundColor =
      this.config.charts?.foregroundColor || DEFAULT_CHART_FOREGROUND
    const thresholdColor =
      this.config.charts?.thresholdColor || DEFAULT_THRESHOLD_COLOR
    canvasCtx.fillStyle = backgroundColor
    canvasCtx.fillRect(0, 0, emitterCanvas.width, emitterCanvas.height)

    let barHeight
    let x = 0
    for (let i = 0; i < audioAnalyser.bufferLength; i++) {
      barHeight = audioAnalyser.dataArray[i] / 2

      canvasCtx.fillStyle = foregroundColor
      canvasCtx.fillRect(
        x,
        emitterCanvas.height - barHeight / 2,
        this.barWidth,
        barHeight
      )

      x += this.barWidth + this.barMargin
    }

    // Draw the VOLUME_THRESHOLD line
    canvasCtx.strokeStyle = thresholdColor
    canvasCtx.beginPath()
    const thresholdY =
      emitterCanvas.height -
      (this.volumeThreshold / CHART_SCALE) * emitterCanvas.height
    canvasCtx.moveTo(0, thresholdY)
    canvasCtx.lineTo(emitterCanvas.width, thresholdY)
    canvasCtx.stroke()
  }

  drawVolume() {
    const drawVisual = requestAnimationFrame(this.drawVolume.bind(this))
    const audioAnalyser = this.analysers?.volume
    const emitterCanvas = this.canvases?.volume
    const canvasCtx = emitterCanvas?.ctx
    if (!audioAnalyser) return
    if (!canvasCtx) return

    const backgroundColor =
      this.config.charts?.backgroundColor || DEFAULT_BACKGROUND_COLOR
    const foregroundColor =
      this.config.charts?.foregroundColor || DEFAULT_CHART_FOREGROUND
    const thresholdColor =
      this.config.charts?.thresholdColor || DEFAULT_THRESHOLD_COLOR
    canvasCtx.fillStyle = backgroundColor
    canvasCtx.fillRect(0, 0, emitterCanvas.width, emitterCanvas.height)

    let x = 0
    for (let i = 0; i < this.volumeData.length; i++) {
      const barHeight =
        (this.volumeData[i] / CHART_SCALE) * emitterCanvas.height

      canvasCtx.fillStyle = foregroundColor
      canvasCtx.fillRect(
        x,
        emitterCanvas.height - barHeight,
        this.barWidth,
        barHeight
      )

      x += this.barWidth + this.barMargin
    }

    // Draw the VOLUME_THRESHOLD line
    canvasCtx.strokeStyle = thresholdColor
    canvasCtx.beginPath()
    const thresholdY =
      emitterCanvas.height -
      (this.volumeThreshold / CHART_SCALE) * emitterCanvas.height
    canvasCtx.moveTo(0, thresholdY)
    canvasCtx.lineTo(emitterCanvas.width, thresholdY)
    canvasCtx.stroke()
  }

  drawThresholdSignal() {
    const drawVisual = requestAnimationFrame(
      this.drawThresholdSignal.bind(this)
    )
    const emitterCanvas = this.canvases?.threshold
    const canvasCtx = emitterCanvas?.ctx
    if (!canvasCtx) return

    const backgroundColor =
      this.config.charts?.backgroundColor || DEFAULT_BACKGROUND_COLOR
    const foregroundColor =
      this.config.charts?.foregroundColor || DEFAULT_CHART_FOREGROUND
    canvasCtx.fillStyle = backgroundColor
    canvasCtx.fillRect(0, 0, emitterCanvas.width, emitterCanvas.height)

    let x = 0
    for (let i = 0; i < this.thresholdSignalData.length; i++) {
      const barHeight =
        (this.thresholdSignalData[i] ? CHART_SCALE : 0) * emitterCanvas.height

      canvasCtx.fillStyle = foregroundColor
      canvasCtx.fillRect(
        x,
        emitterCanvas.height - barHeight,
        this.barWidth,
        barHeight
      )

      x += this.barWidth + this.barMargin
    }
  }

  drawSpeakingSignal() {
    const drawVisual = requestAnimationFrame(this.drawSpeakingSignal.bind(this))
    const emitterCanvas = this.canvases?.speaking
    const canvasCtx = emitterCanvas?.ctx
    if (!canvasCtx) return

    const backgroundColor =
      this.config.charts?.backgroundColor || DEFAULT_BACKGROUND_COLOR
    const foregroundColor =
      this.config.charts?.foregroundColor || DEFAULT_CHART_FOREGROUND
    canvasCtx.fillStyle = backgroundColor
    canvasCtx.fillRect(0, 0, emitterCanvas.width, emitterCanvas.height)

    let x = 0
    for (let i = 0; i < this.speakingSignalData.length; i++) {
      const barHeight =
        (this.speakingSignalData[i] ? CHART_SCALE : 0) * emitterCanvas.height

      canvasCtx.fillStyle = foregroundColor
      canvasCtx.fillRect(
        x,
        emitterCanvas.height - barHeight,
        this.barWidth,
        barHeight
      )

      x += this.barWidth + this.barMargin
    }
  }

  static encodeMP3(audioBuffer: AudioBuffer, bitRate: number = 128): Blob {
    const channels = 1 // Assuming mono audio
    const sampleRate = audioBuffer.sampleRate
    const audioData = audioBuffer.getChannelData(0)

    //convert the audio data to 16 bit pcm
    const samples = new Int16Array(audioData.length)
    for (let i = 0; i < audioData.length; i++) {
      samples[i] = audioData[i] * 0x7fff
    }

    // create mp3 encoder
    const kbps = bitRate
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps)
    const sampleBlockSize = 1152
    let sampleChunk
    const mp3Data = []

    // encode mp3
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      sampleChunk = samples.subarray(i, i + sampleBlockSize)
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk)
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf)
      }
    }

    return new Blob(mp3Data, { type: "audio/mp3" })
  }
}

export { UtteranceEmitter }
