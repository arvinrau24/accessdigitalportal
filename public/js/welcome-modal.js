/**
 * Welcome Modal for First-Time Client Login
 * Shows an interactive walkthrough for first-time client access.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'hasSeenWelcome';
  let currentStep = 1;
  const totalSteps = 4;

  // DOM Elements
  const backdrop = document.getElementById('welcomeBackdrop');
  const modal = document.getElementById('welcomeModal');
  const closeBtn = document.getElementById('welcomeClose');
  const skipBtn = document.getElementById('welcomeSkip');
  const continueBtn = document.getElementById('welcomeContinue');
  const continueText = document.getElementById('continueText');
  const steps = document.querySelectorAll('.welcome-step');
  const progressDots = document.querySelectorAll('.welcome-progress-dot');

  /**
   * Check if user has seen the welcome modal before
   */
  function hasSeenWelcome() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  /**
   * Mark that user has seen the welcome modal
   */
  function markAsShown() {
    localStorage.setItem(STORAGE_KEY, 'true');
  }

  /**
   * Show the welcome modal with animation
   */
  function showModal() {
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide the welcome modal
   */
  function hideModal() {
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
    markAsShown();
  }

  /**
   * Navigate to a specific step
   */
  function goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > totalSteps) return;

    currentStep = stepNumber;

    // Update steps visibility
    steps.forEach((step, index) => {
      if (index + 1 === currentStep) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    // Update progress dots
    progressDots.forEach((dot, index) => {
      if (index + 1 === currentStep) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // Update continue button text
    if (currentStep === totalSteps) {
      continueText.textContent = 'Get Started';
    } else {
      continueText.textContent = 'Continue';
    }
  }

  /**
   * Handle continue button click
   */
  function handleContinue() {
    if (currentStep < totalSteps) {
      goToStep(currentStep + 1);
    } else {
      // Last step - close modal
      hideModal();
    }
  }

  /**
   * Handle skip button click
   */
  function handleSkip() {
    hideModal();
  }

  /**
   * Handle close button click
   */
  function handleClose() {
    hideModal();
  }

  /**
   * Handle backdrop click (close modal when clicking outside)
   */
  function handleBackdropClick(event) {
    if (event.target === backdrop) {
      hideModal();
    }
  }

  /**
   * Handle keyboard events (ESC to close)
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape' && backdrop.classList.contains('active')) {
      hideModal();
    }
  }

  /**
   * Initialize the welcome modal
   */
  function init() {
    // Check if user has seen the welcome modal
    if (hasSeenWelcome()) {
      return; // Don't show modal if already seen
    }

    // Wait a bit for the page to load, then show modal
    setTimeout(() => {
      showModal();
    }, 500);

    // Event listeners
    closeBtn.addEventListener('click', handleClose);
    skipBtn.addEventListener('click', handleSkip);
    continueBtn.addEventListener('click', handleContinue);
    backdrop.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKeyDown);

    // Progress dot click navigation
    progressDots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        goToStep(index + 1);
      });
      dot.style.cursor = 'pointer';
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose function to reset the welcome modal (for testing/debugging)
  window.resetWelcomeModal = function() {
    localStorage.removeItem(STORAGE_KEY);
    currentStep = 1;
    goToStep(1);
    console.log('Welcome modal reset. Reload the page to see it again.');
  };

})();
