# Utterance Emitter

Utterance Emitter is a Node.js library for recording audio in a browser, performing speaker detection, and emitting chunks of mp3 encoded audio representing utterances for further processing.

## Installation

```sh
npm install utterance-emitter
```

## Usage

```javascript
const { recordAudio } = require('utterance-emitter');

console.log(recordAudio()); // "Recording audio..."
```

## Running Tests

```sh
npm test
```
