export const motionTokens = {
  duration: {
    cardEnter: 240,
    cardFlip: 280,
    correct: 360,
    incorrect: 330,
    pawnStep: 420,
    plusOnePause: 160,
    plusOnePulse: 340,
    reconnect: 620,
    victory: 2300,
  },
  easing: {
    enter: 'cubic-bezier(.22,1,.36,1)',
    exit: 'cubic-bezier(.4,0,1,1)',
    pawn: 'cubic-bezier(.45,0,.2,1)',
    springSoft: 'cubic-bezier(.2,.9,.3,1.15)',
  },
} as const;
