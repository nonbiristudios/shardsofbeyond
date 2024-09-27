window.addEventListener('DOMContentLoaded', () => {
  const paragraphLeft = document.querySelector('.left');
  const paragraphRight = document.querySelector('.right');

  // Shift all explanations to the right paragraph side.
  const explanations = document.querySelectorAll('.explanation');
  explanations.forEach((explanation) => {
    // Insert an anchor to the original position.
    const anchor = document.createElement('tspan');
    explanation.insertAdjacentElement('afterend', anchor);

    // Consume the explanation and create an explanation entry on the right.
    const explanationString = explanation.innerHTML;
    
    // Delete original element.
    explanation.remove();

    const newExplanation = document.createElement('div');
    newExplanation.classList.add('explanation');
    newExplanation.innerHTML = explanationString;

    paragraphRight.appendChild(newExplanation);
    
    const onResize = () => {
      const offsetTop = anchor.offsetTop;
      newExplanation.style.top = offsetTop + "px";
    };
    addEventListener("resize", onResize);
    onResize();
  });
});