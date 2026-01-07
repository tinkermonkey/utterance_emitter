export class AudioAnalyser {
  fftSize?: number;
  bufferLength: number;
  dataArray: Uint8Array<ArrayBuffer>;
  node: AnalyserNode;

  constructor(context: AudioContext, source: MediaStreamAudioSourceNode, fftSize?: number) {
    this.fftSize = fftSize;
    this.node = context.createAnalyser();
    this.bufferLength = this.node.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    source.connect(this.node);
  }
}