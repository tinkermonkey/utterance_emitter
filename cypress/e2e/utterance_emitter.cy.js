describe('Utterance Emitter', () => {
  beforeEach(() => {
    // Force browser reload between tests
    Cypress.session.clearAllSavedSessions()
    cy.visit('/')
    cy.viewport(800, 1200)
  })

  // The test recording is set to loop and is about 3.5 seconds long
  it('should recognize an utterance', { browser: 'chromium' }, () => {
    cy.get('#startButton').click()
    cy.wait(3500) // longer wait for longer file
    cy.get('#stopButton').click()
    cy.get('#mp3RecordingsList').children().should('have.length', 1)
  })

  it('should recognize 2 utterances', { browser: 'chromium' }, () => {
    cy.get('#startButton').click()
    cy.wait(7500) // longer wait for longer file
    cy.get('#stopButton').click()
    cy.get('#mp3RecordingsList').children().should('have.length', 2)
  })

  it('should recognize 3 utterances', { browser: 'chromium' }, () => {
    cy.get('#startButton').click()
    cy.wait(10000) // longer wait for longer file
    cy.get('#stopButton').click()
    cy.get('#mp3RecordingsList').children().should('have.length', 3)
  })
})
