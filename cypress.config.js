import path from 'path'
import { defineConfig } from 'cypress'
import * as dotenv from 'dotenv'
dotenv.config()

const shortAudioFile = 'cypress/test_data/hello.wav'

export default defineConfig({
  projectId: process.env.CYPRESS_PROJECT_ID,
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
          //launchOptions.args.push(`--use-file-for-fake-audio-capture=${path.resolve(import.meta.dirname, currentAudioFile)}%%noloop`)
          launchOptions.args.push(`--use-file-for-fake-audio-capture=${path.resolve(import.meta.dirname, shortAudioFile)}`)
        }
        return launchOptions
      })
    },
    baseUrl: 'http://localhost:3100',
    browser: 'chromium'
  },
})
