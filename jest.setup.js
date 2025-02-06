global.audioStream = null;

global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn().mockImplementation(() => {
      return global.audioStream
    })
  }
};