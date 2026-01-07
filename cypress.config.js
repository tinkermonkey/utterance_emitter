import path from 'path'
import { defineConfig } from 'cypress'
import * as dotenv from 'dotenv'
dotenv.config()

const shortAudioFile = 'cypress/test_data/hello.wav'

export default defineConfig({
  projectId: process.env.CYPRESS_PROJECT_ID,
  experimentalMemoryManagement: true,
  numTestsKeptInMemory: 0,
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
        if (browser.name === 'chromium' || browser.name === 'chrome') {
          launchOptions.args.push('--no-sandbox')
          launchOptions.args.push('--disable-dev-shm-usage')
          launchOptions.args.push('--disable-gpu')
          launchOptions.args.push('--js-flags=--max-old-space-size=4096')
          launchOptions.args.push('--allow-file-access-from-files')
          launchOptions.args.push('--use-fake-ui-for-media-stream')
          launchOptions.args.push('--use-fake-device-for-media-stream')
          launchOptions.args.push('--enable-features=SharedArrayBuffer')
          //launchOptions.args.push(`--use-file-for-fake-audio-capture=${path.resolve(import.meta.dirname, currentAudioFile)}%%noloop`)
          launchOptions.args.push(`--use-file-for-fake-audio-capture=${path.resolve(import.meta.dirname, shortAudioFile)}`)
        }
        return launchOptions
      })
    },
    baseUrl: 'http://localhost:3100',
    browser: 'chrome'
  },
})
