global.AudioContext = require('web-audio-test-api').AudioContext;

global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn().mockImplementation((constraints) => {
      if (!global.audioStream) {
        return Promise.reject(new Error('No audio stream available'));
      }
      return Promise.resolve(global.audioStream);
    })
  }
};

global.MediaRecorder = class MediaRecorder {
  constructor() {
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }
  
  start() {
    this.state = 'recording';
  }
  
  stop() {
    this.state = 'inactive';
    if (this.onstop) this.onstop();
  }
};

global.audioStream = null;
