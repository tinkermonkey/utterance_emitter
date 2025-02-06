import { UtteranceEmitter } from './dist/bundle.js';

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const recordingsList = document.getElementById("recordingsList");

const emitter = new UtteranceEmitter({
  onUtterance: (utterance) => {
    if (utterance.mp3) {
      const url = URL.createObjectURL(utterance.mp3);
      const li = document.createElement("li");
      const audio = document.createElement("audio");
      const downloadLink = document.createElement("a");

      audio.controls = true;
      audio.src = url;
      downloadLink.href = url;
      downloadLink.download = `recording_${recordingsList.children.length}.mp3`;
      downloadLink.textContent = `Download recording ${recordingsList.children.length}`;

      li.appendChild(audio);
      li.appendChild(downloadLink);
      recordingsList.appendChild(li);
    }
  }
});

startButton.addEventListener("click", () => emitter.start());
stopButton.addEventListener("click", () => emitter.stop());
