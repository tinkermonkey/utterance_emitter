global.audioStream = null;

// Create a complete mock of navigator.mediaDevices
global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn().mockImplementation((constraints) => {
      return Promise.resolve(global.audioStream);
    })
  }
};
