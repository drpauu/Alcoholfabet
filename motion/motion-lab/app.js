(() => {
  const scene = document.querySelector('#scene');
  const card = document.querySelector('#card');
  const pawn = document.querySelector('#pawn');
  const plusBadge = document.querySelector('#plusBadge');
  const disconnectTitle = document.querySelector('#disconnectTitle');
  const disconnectText = document.querySelector('#disconnectText');
  const soundToggle = document.querySelector('#soundToggle');
  const particles = document.querySelector('#particles');
  const confettiHost = document.querySelector('#confettiHost');

  const soundBase = '../../assets/production/sounds/';
  const sounds = {
    question: new Audio(soundBase + 'card_slide.wav'),
    flip: new Audio(soundBase + 'card_flip.wav'),
    correct: new Audio(soundBase + 'correct.wav'),
    incorrect: new Audio(soundBase + 'incorrect.wav'),
    step: new Audio(soundBase + 'pawn_step.wav'),
    plus: new Audio(soundBase + 'plus_one.wav'),
    drink: new Audio(soundBase + 'drink.wav'),
    victory: new Audio(soundBase + 'victory.wav')
  };
  Object.values(sounds).forEach((audio) => { audio.preload = 'auto'; audio.volume = 0.48; });

  let soundEnabled = true;
  let pawnStep = 0;
  const pawnPoints = [
    [10.5, 375], [23, 300], [36, 345], [48, 260], [61, 220], [73.5, 290], [84, 285], [91, 170]
  ];

  const play = (name) => {
    if (!soundEnabled) return;
    const audio = sounds[name];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const resetTransient = () => {
    scene.classList.remove('card-enter', 'correct', 'incorrect', 'plus', 'victory', 'reconnected');
    plusBadge.style.opacity = '';
  };

  const setupParticles = () => {
    particles.textContent = '';
    [[-28,-16],[24,-24],[8,-34]].forEach(([dx,dy]) => {
      const span = document.createElement('span');
      span.style.setProperty('--dx', dx + 'px');
      span.style.setProperty('--dy', dy + 'px');
      particles.append(span);
    });
  };

  const movePawn = async (steps = 1) => {
    for (let i = 0; i < steps; i += 1) {
      pawnStep = Math.min(pawnStep + 1, pawnPoints.length - 1);
      const [left, top] = pawnPoints[pawnStep];
      pawn.animate([
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-8px) scale(1.02)', offset: .45 },
        { transform: 'translateY(0) scale(1)' }
      ], { duration: 420, easing: 'cubic-bezier(.45,0,.2,1)' });
      pawn.style.transition = 'left 420ms cubic-bezier(.45,0,.2,1), top 420ms cubic-bezier(.45,0,.2,1)';
      pawn.style.left = `calc(${left}% - 21px)`;
      pawn.style.top = `${top}px`;
      await new Promise((resolve) => setTimeout(resolve, 325));
      play('step');
      await new Promise((resolve) => setTimeout(resolve, 95));
    }
  };

  const showConfetti = () => {
    confettiHost.textContent = '';
    const colors = ['#2f73b8','#d84f76','#d5a244','#738a66','#8b76a8'];
    for (let i = 0; i < 16; i += 1) {
      const p = document.createElement('span');
      p.style.left = `${20 + Math.random() * 60}%`;
      p.style.top = `${15 + Math.random() * 15}%`;
      p.style.background = colors[i % colors.length];
      p.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 0 },
        { opacity: 1, offset: .15 },
        { transform: `translate(${(Math.random()-.5)*320}px, ${180 + Math.random()*180}px) rotate(${180+Math.random()*360}deg)`, opacity: 0 }
      ], { duration: 1000 + Math.random()*350, delay: 520 + Math.random()*220, easing: 'cubic-bezier(.2,.8,.3,1)' });
      confettiHost.append(p);
    }
  };

  const actions = {
    question() {
      resetTransient();
      void card.offsetWidth;
      scene.classList.add('card-enter');
      play('question');
    },
    flip() {
      scene.classList.toggle('flipped');
      play('flip');
    },
    correct() {
      resetTransient(); setupParticles(); void card.offsetWidth;
      scene.classList.add('correct');
      play('correct');
      setTimeout(() => movePawn(1), 360);
    },
    incorrect() {
      resetTransient(); void card.offsetWidth;
      scene.classList.add('incorrect');
      play('incorrect');
      setTimeout(() => play('drink'), 220);
    },
    move() { resetTransient(); movePawn(1); },
    async plus() {
      resetTransient(); scene.classList.add('plus');
      await movePawn(1);
      await new Promise((resolve) => setTimeout(resolve, 160));
      play('plus');
      plusBadge.animate([{transform:'scale(.75) rotate(-6deg)',opacity:0},{transform:'scale(1.12) rotate(2deg)',opacity:1,offset:.55},{transform:'scale(1) rotate(-3deg)',opacity:1}], {duration:340,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
      await new Promise((resolve) => setTimeout(resolve, 340));
      await movePawn(1);
    },
    disconnect() {
      resetTransient();
      disconnectTitle.textContent = "S'ha perdut la connexió";
      disconnectText.textContent = "S'està reconnectant…";
      scene.classList.add('disconnected');
    },
    reconnect() {
      if (!scene.classList.contains('disconnected')) scene.classList.add('disconnected');
      scene.classList.add('reconnected');
      disconnectTitle.textContent = "T'has tornat a connectar";
      disconnectText.textContent = 'La partida continua.';
      document.querySelector('.wifi-cross').textContent = '✓';
      setTimeout(() => {
        scene.classList.remove('disconnected', 'reconnected');
        document.querySelector('.wifi-cross').textContent = '⌁';
      }, 620);
    },
    victory() {
      resetTransient(); showConfetti(); scene.classList.add('victory'); play('victory');
    },
    reset() {
      scene.className = 'scene';
      pawnStep = 0;
      pawn.style.left = 'calc(10.5% - 21px)';
      pawn.style.top = '375px';
      pawn.style.transition = '';
      document.querySelector('.wifi-cross').textContent = '⌁';
      resetTransient();
    }
  };

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => actions[button.dataset.action]?.());
  });

  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = `So: ${soundEnabled ? 'activat' : 'desactivat'}`;
    soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  });

  setupParticles();
})();
