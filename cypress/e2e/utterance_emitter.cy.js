describe('Utterance Emitter', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should start and stop recording', () => {
    cy.get('#startButton').click()
    cy.wait(5000)
    cy.get('#stopButton').click()
    cy.get('#mp3RecordingsList').children().should('have.length', 1)
  })
})