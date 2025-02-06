describe('Utterance Emitter', () => {
  beforeEach(() => {
    // Force browser reload between tests
    Cypress.session.clearAllSavedSessions()
    cy.visit('/')
  })

  it('should record short audio', { browser: 'chromium' }, () => {
    cy.task('setTestAudio', 'cypress/test_data/hello_hello.wav')
    cy.get('#startButton').click()
    cy.wait(5000)
    cy.get('#stopButton').click()
    cy.get('#mp3RecordingsList').children().should('have.length', 1)
  })

  it('should record long audio', { browser: 'chromium' }, () => {
    cy.task('setTestAudio', 'cypress/test_data/hello_and_goodbye.wav')
    cy.get('#startButton').click()
    cy.wait(5000) // longer wait for longer file
    cy.get('#stopButton').click()
    cy.get('#mp3RecordingsList').children().should('have.length', 2)
  })
})
