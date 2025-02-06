import path from 'path'
import { defineConfig } from 'cypress'

const shortAudioFile = 'cypress/test_data/hello.wav'
const longTestFile = 'cypress/test_data/hello_and_goodbye.wav'
const cantinaTestFile = 'cypress/test_data/CantinaBand3.wav'
let currentAudioFile = shortAudioFile // default audio file

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        setTestAudio: (audioFile) => {
          currentAudioFile = audioFile
          return null
        }
      })

      on('before:browser:launch', (browser = {}, launchOptions) => {
        // `args` is an array of arguments passed to the browser
        if (browser.name === 'chromium') {
          launchOptions.args.push('--no-sandbox')
          launchOptions.args.push('--allow-file-access-from-files')
          launchOptions.args.push('--use-fake-ui-for-media-stream')
          launchOptions.args.push('--use-fake-device-for-media-stream')
          launchOptions.args.push(`--use-file-for-fake-audio-capture=${path.resolve(import.meta.dirname, currentAudioFile)}%%noloop`)
        }
        return launchOptions
      })
    },
    baseUrl: 'http://localhost:8080',
    browser: 'chromium'
  },
})
