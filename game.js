(function() {
  'use strict';

  // ==================== НАСТРОЙКИ ====================
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const SPEED_FACTOR = isTouchDevice ? 1.4 : 1.0;

  const VIRTUAL_W = 480;
  const VIRTUAL_H = 320;
  const PLAYER_SPEED = 5 * SPEED_FACTOR;
  const BULLET_SPEED = -6 * SPEED_FACTOR;
  const ENEMY_BULLET_SPEED = 3 * SPEED_FACTOR;
  const PLAYER_W = 16, PLAYER_H = 14;
  const ENEMY_COLS = 7;
  const ENEMY_ROWS = 3;
  const ENEMY_W = 24, ENEMY_H = 20;
  const ENEMY_PAD = 10;
  const ENEMY_START_Y = 50;
  const PLAYER_Y = VIRTUAL_H - 40;
  const ROCKET_SPEED = 5 * SPEED_FACTOR;
  const AOE_RADIUS = 48;

  // ==================== АУДИО ====================
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function beep(f, d, t, v = 0.08) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = t;
    o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
  }

  function sweepBeep(f1, f2, d, t, v = 0.08) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = t;
    o.frequency.setValueAtTime(f1, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f2, audioCtx.currentTime + d);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
  }

  function noiseBurst(d, v = 0.06) {
    if (!audioCtx) return;
    const bufSize = Math.floor(audioCtx.sampleRate * d);
    const buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
    src.connect(g); g.connect(audioCtx.destination);
    src.start(); src.stop(audioCtx.currentTime + d);
  }

  const sfx = {
    shoot:     () => beep(800, 0.1, 'square'),
    hit:       () => beep(200, 0.15, 'sawtooth', 0.1),
    death:     () => beep(100, 0.4, 'triangle', 0.15),
    rocket_launch: () => sweepBeep(600, 150, 0.35, 'sawtooth', 0.09),
    rocket_boom:   () => { noiseBurst(0.3, 0.1); beep(45, 0.35, 'triangle', 0.15); },
    nuke:      () => beep(35, 1.0, 'triangle', 0.25),
    pickup:    () => beep(600, 0.08, 'square', 0.05),
    boss_hit:  () => beep(120, 0.12, 'square', 0.12),
    boss_death:() => { noiseBurst(0.5, 0.15); beep(30, 0.7, 'triangle', 0.2); },
    level_up:  () => { beep(440, 0.1, 'square', 0.05); beep(660, 0.15, 'square', 0.06); }
  };

  // ==================== MORTAL KOMBAT 8-BIT THEME ====================
  let musicPlaying = false;
  let musicTimer = null;
  let musicNoteIdx = 0;

  const mkTheme = [
    [466,0.14],[494,0.14],[523,0.14],[466,0.14],
    [554,0.14],[523,0.14],[587,0.14],[554,0.14],
    [466,0.14],[523,0.14],[554,0.14],[587,0.14],
    [554,0.14],[587,0.14],[622,0.26],
    [466,0.14],[494,0.14],[523,0.14],[466,0.14],
    [554,0.14],[523,0.14],[587,0.14],[554,0.14],
    [622,0.14],[587,0.14],[554,0.14],[523,0.14],
    [494,0.14],[466,0.14],[440,0.26],
    [698,0.09],[659,0.09],[622,0.09],[587,0.09],
    [554,0.09],[523,0.09],[494,0.09],[466,0.09],
    [587,0.09],[554,0.09],[523,0.09],[494,0.09],
    [466,0.09],[440,0.09],[415,0.09],[392,0.09],
    [466,0.09],[494,0.09],[523,0.09],[554,0.11],
    [587,0.11],[622,0.11],[659,0.28],
    [370,0.09],[392,0.09],[415,0.09],[440,0.09],
    [466,0.09],[494,0.09],[523,0.09],[554,0.09],
    [587,0.09],[622,0.09],[659,0.09],[698,0.18],
    [659,0.09],[622,0.09],[587,0.09],[554,0.18],
  ];

  function startMusic() {
    if (musicPlaying || !audioCtx) return;
    musicPlaying = true;
    musicNoteIdx = 0;
    playMK();
  }
  function stopMusic() {
    musicPlaying = false;
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  }
  function playMK() {
    if (!musicPlaying || !audioCtx) return;
    if (musicNoteIdx >= mkTheme.length) musicNoteIdx = 0;
    const [freq, dur] = mkTheme[musicNoteIdx];
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.055, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now); o.stop(now + dur);
    musicNoteIdx++;
    musicTimer = setTimeout(playMK, dur * 1000);
  }

  // ==================== PARTICLE ====================
  class Particle {
    constructor(x, y, color, speedMult = 1) {
      this.x = x; this.y = y;
      const a = Math.random() * Math.PI * 2;
      const s = (0.5 + Math.random() * 3.5) * speedMult;
      this.vx = Math.cos(a) * s;
      this.vy = Math.sin(a) * s - 0.8 * speedMult;
      this.life = 15 + Math.random() * 28;
      this.maxLife = this.life;
      this.color = color;
      this.size = 1 + Math.random() * 2.5;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 0.03 * dt;
      this.life -= dt;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
      ctx.globalAlpha = 1;
    }
    get alive() { return this.life > 0; }
  }

  // ==================== ИГРОВЫЕ КЛАССЫ ====================
  class Player {
    constructor() {
      this.w = PLAYER_W; this.h = PLAYER_H;
      this.x = VIRTUAL_W / 2 - this.w / 2;
      this.y = PLAYER_Y;
      this.lives = 3;
      this.invincible = 0;
      this.rockets = 0;
    }
    update(keys, dt) {
      if (this.invincible > 0) this.invincible -= dt;
      if (keys.left)  this.x -= PLAYER_SPEED * dt;
      if (keys.right) this.x += PLAYER_SPEED * dt;
      this.x = Math.max(0, Math.min(VIRTUAL_W - this.w, this.x));
    }
    draw(ctx) {
      if (this.invincible > 0 && Math.floor(this.invincible / 3) % 2 === 0) return;
      ctx.fillStyle = '#0ff';
      ctx.shadowColor = '#0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(this.x + this.w / 2, this.y);
      ctx.lineTo(this.x, this.y + this.h);
      ctx.lineTo(this.x + this.w, this.y + this.h);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#0ff8';
      ctx.beginPath();
      ctx.moveTo(this.x + this.w / 2, this.y + this.h);
      ctx.lineTo(this.x + this.w / 2 - 3, this.y + this.h + 5);
      ctx.lineTo(this.x + this.w / 2 + 3, this.y + this.h + 5);
      ctx.closePath();
      ctx.fill();
    }
    giveRockets(n) { this.rockets += n; }
    hitEnemy() {
      if (this.invincible > 0) return false;
      this.lives--;
      this.invincible = 90;
      return this.lives <= 0;
    }
  }

  class Enemy {
    constructor(col, row) {
      this.w = ENEMY_W; this.h = ENEMY_H;
      this.x = 40 + col * (ENEMY_W + ENEMY_PAD);
      this.y = ENEMY_START_Y + row * (ENEMY_H + ENEMY_PAD);
      this.alive = true;
      this.prevY = this.y;
    }
    draw(ctx) {
      if (!this.alive) return;
      ctx.fillStyle = '#f0f';
      ctx.fillRect(this.x + 2, this.y + 2, this.w - 4, this.h - 4);
      ctx.fillStyle = '#f4b';
      ctx.fillRect(this.x + this.w / 2 - 3, this.y + this.h - 4, 6, 4);
      ctx.fillStyle = '#0ff';
      ctx.fillRect(this.x + 6, this.y + 5, 4, 4);
      ctx.fillRect(this.x + this.w - 10, this.y + 5, 4, 4);
    }
  }

  class Bullet {
    constructor(x, y, vx, vy, isEnemy = false) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.isEnemy = isEnemy;
      this.w = 4; this.h = 10;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; }
    draw(ctx) {
      ctx.fillStyle = this.isEnemy ? '#f44' : '#0f0';
      ctx.shadowColor = this.isEnemy ? '#f44' : '#0f0';
      ctx.shadowBlur = 4;
      ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
      ctx.shadowBlur = 0;
    }
    isOffScreen() {
      return this.y + this.h < -10 || this.y > VIRTUAL_H + 10 ||
             this.x < -10 || this.x > VIRTUAL_W + 10;
    }
  }

  class Rocket extends Bullet {
    constructor(x, y) {
      super(x, y, 0, -ROCKET_SPEED * 0.5, false);
      this.w = 6; this.h = 14;
      this.trail = [];
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.trail.push({ x: this.x, y: this.y, life: 6 });
      for (const t of this.trail) t.life -= dt;
      this.trail = this.trail.filter(t => t.life > 0);
    }
    draw(ctx) {
      for (const t of this.trail) {
        const a = t.life / 6;
        ctx.fillStyle = `rgba(255,160,0,${a * 0.6})`;
        ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
      }
      ctx.fillStyle = '#ff0';
      ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
      ctx.fillStyle = '#f80';
      ctx.fillRect(this.x - 1, this.y - this.h / 2, 2, this.h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x - 1, this.y - this.h / 2 + 2, 2, 4);
    }
  }

  class PowerUp {
    constructor(x, y, type) {
      this.x = x; this.y = y;
      this.w = 14; this.h = 14;
      this.type = type;
      this.vy = 2 * SPEED_FACTOR;
      this.alive = true;
      this.age = 0;
    }
    update(dt) {
      this.y += this.vy * dt;
      this.age += dt;
      if (this.y > VIRTUAL_H + 20) this.alive = false;
    }
    draw(ctx) {
      const color = this.type === 'rocket' ? '#ff0' : this.type === 'nuke' ? '#f80' : '#0f0';
      const pulse = 1 + 0.1 * Math.sin(this.age * 0.15);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 * pulse;
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const icon = { rocket: '🚀', nuke: '⚡', shield: '🛡️' }[this.type];
      ctx.fillText(icon, this.x + this.w / 2, this.y + this.h / 2 + 3);
      ctx.textAlign = 'start';
    }
  }

  class Shockwave {
    constructor(x, y, maxR) {
      this.x = x; this.y = y;
      this.radius = 8;
      this.maxRadius = maxR || VIRTUAL_W * 0.75;
      this.speed = 7;
      this.alive = true;
    }
    update(dt) {
      this.radius += this.speed * dt;
      if (this.radius >= this.maxRadius) this.alive = false;
    }
    draw(ctx) {
      const a = 1 - this.radius / this.maxRadius;
      ctx.strokeStyle = `rgba(255,255,200,${a * 0.9})`;
      ctx.lineWidth = 4 * a;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,180,50,${a * 0.5})`;
      ctx.lineWidth = 8 * a;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.3})`;
      ctx.lineWidth = 12 * a;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ==================== BOSS ====================
  class Boss {
    constructor(level) {
      this.w = 50; this.h = 38;
      this.x = VIRTUAL_W / 2 - this.w / 2;
      this.y = 25;
      this.hp = 12 + Math.floor((level - 5) / 5) * 8;
      this.maxHp = this.hp;
      this.alive = true;
      this.vx = 1.5 * SPEED_FACTOR;
      this.shootTimer = 0;
      this.shootInterval = 32 / SPEED_FACTOR;
      this.patternIdx = 0;
      this.flashTimer = 0;
      this.enterTimer = 0;
      this.enterDuration = 60;
    }
    update(dt, bullets, playerX) {
      if (this.enterTimer < this.enterDuration) {
        this.enterTimer += dt;
        this.y = 25 + (1 - this.enterTimer / this.enterDuration) * 60;
        return;
      }
      this.x += this.vx * dt;
      if (this.x <= 2) { this.x = 2; this.vx = Math.abs(this.vx); }
      if (this.x + this.w >= VIRTUAL_W - 2) { this.x = VIRTUAL_W - 2 - this.w; this.vx = -Math.abs(this.vx); }
      if (this.flashTimer > 0) this.flashTimer -= dt;
      this.shootTimer += dt;
      if (this.shootTimer >= this.shootInterval) {
        this.shootTimer = 0;
        this.shoot(bullets, playerX);
      }
    }
    shoot(bullets, playerX) {
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h;
      this.patternIdx = (this.patternIdx + 1) % 4;
      const spd = ENEMY_BULLET_SPEED;
      if (this.patternIdx === 0) {
        for (let a = -0.4; a <= 0.4; a += 0.2)
          bullets.push(new Bullet(cx, cy, Math.sin(a) * 2, spd * 1.3, true));
      } else if (this.patternIdx === 1) {
        const dx = playerX - cx;
        const dist = Math.max(Math.abs(dx), 20);
        bullets.push(new Bullet(cx, cy, (dx / dist) * 2.5, spd * 1.2, true));
        bullets.push(new Bullet(cx, cy, 0, spd * 1.2, true));
      } else if (this.patternIdx === 2) {
        for (let i = -3; i <= 3; i++)
          bullets.push(new Bullet(cx, cy, i * 1.3, spd * 1.1, true));
      } else {
        for (let i = 0; i < 5; i++)
          bullets.push(new Bullet(cx, cy, Math.sin(-0.5 + i * 0.25) * 2.5, spd * 1.2, true));
      }
    }
    hit(dmg) {
      this.hp -= dmg;
      this.flashTimer = 5;
      if (this.hp <= 0) { this.alive = false; return true; }
      return false;
    }
    draw(ctx) {
      if (!this.alive) return;
      const flash = this.flashTimer > 0 && Math.floor(this.flashTimer * 10) % 2 === 0;
      const c1 = flash ? '#fff' : '#d22';
      const c2 = flash ? '#fff' : '#911';
      const c3 = flash ? '#fff' : '#b11';

      const barW = this.w + 6; const barH = 6;
      const barX = this.x - 3; const barY = this.y - 16;
      ctx.fillStyle = '#222';
      ctx.fillRect(barX, barY, barW, barH);
      const ratio = Math.max(0, this.hp / this.maxHp);
      const hpC = ratio > 0.5 ? '#0f0' : ratio > 0.25 ? '#ff0' : '#f33';
      ctx.fillStyle = hpC;
      ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.fillStyle = '#fff';
      ctx.font = '8px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('BOSS', this.x + this.w / 2, barY - 3);
      ctx.textAlign = 'start';

      ctx.fillStyle = c1;
      ctx.fillRect(this.x + 4, this.y + 6, this.w - 8, this.h - 10);
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y + 8);
      ctx.lineTo(this.x + 8, this.y);
      ctx.lineTo(this.x + this.w - 8, this.y);
      ctx.lineTo(this.x + this.w, this.y + 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = c3;
      ctx.fillRect(this.x + 6, this.y + 10, this.w - 12, 10);
      ctx.fillStyle = '#ff0';
      ctx.shadowColor = '#ff0'; ctx.shadowBlur = 6;
      ctx.fillRect(this.x + 12, this.y + 12, 8, 6);
      ctx.fillRect(this.x + this.w - 20, this.y + 12, 8, 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f00';
      ctx.fillRect(this.x + 14, this.y + 13, 4, 4);
      ctx.fillRect(this.x + this.w - 18, this.y + 13, 4, 4);
      ctx.fillStyle = '#500';
      ctx.fillRect(this.x + this.w / 2 - 7, this.y + this.h - 10, 14, 8);
      ctx.fillStyle = '#f80';
      ctx.fillRect(this.x + this.w / 2 - 3, this.y + this.h - 12, 6, 4);
      ctx.fillStyle = c2;
      ctx.fillRect(this.x - 2, this.y + this.h - 14, 8, 10);
      ctx.fillRect(this.x + this.w - 6, this.y + this.h - 14, 8, 10);
      ctx.fillStyle = '#f80';
      ctx.fillRect(this.x, this.y + this.h - 16, 4, 4);
      ctx.fillRect(this.x + this.w - 4, this.y + this.h - 16, 4, 4);
    }
  }

  // ==================== GAME ====================
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scale = 1;
      this.resize();
      this.bgStars = this.generateStars(120);

      this.guiPanel      = document.getElementById('gameover-panel');
      this.finalScoreSpan = document.getElementById('finalScore');
      this.nameInput     = document.getElementById('playerName');
      this.saveBtn       = document.getElementById('saveBtn');
      this.restartBtn    = document.getElementById('restartBtn');
      this.leaderboardDiv= document.getElementById('leaderboard');
      this.helpBtn       = document.getElementById('helpBtn');
      this.helpPanel     = document.getElementById('helpPanel');
      this.musicBtn      = document.getElementById('musicBtn');
      this.helpVisible   = false;

      this.resetGame();
      this.bindEvents();
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }

    generateStars(n) {
      const arr = [];
      for (let i = 0; i < n; i++) {
        arr.push({
          x: Math.random() * VIRTUAL_W,
          y: Math.random() * VIRTUAL_H,
          speed: 0.3 + Math.random() * 1.2,
          size: 0.5 + Math.random() * 1.5
        });
      }
      return arr;
    }

    updateStars(dt) {
      for (const s of this.bgStars) {
        s.y += s.speed * SPEED_FACTOR * dt;
        if (s.y > VIRTUAL_H) { s.y = 0; s.x = Math.random() * VIRTUAL_W; }
      }
    }

    resetGame() {
      this.player = new Player();
      this.enemies = [];
      this.bullets = [];
      this.powerups = [];
      this.particles = [];
      this.shockwaves = [];
      this.boss = null;
      this.score = 0;
      this.level = 1;
      this.state = 'playing';
      this.enemyDir = 1;
      this.enemySpeed = 1.0 * SPEED_FACTOR;
      this.enemyStepDown = 6;
      this.enemyShootTimer = 0;
      this.enemyShootInterval = 55 / SPEED_FACTOR;
      this.fireCooldown = 0;
      this.keys = { left: false, right: false, fire: false, rocket: false };
      this.shakeX = 0; this.shakeY = 0;
      this.flashAlpha = 0;
      this.dt = 1;
      this.levelTransition = 0;
      this._bounceLocked = false;
      this._prevMaxEnemyY = 0;
      this._bossNext = false;
      this.createEnemies();
    }

    createEnemies() {
      for (let r = 0; r < ENEMY_ROWS; r++)
        for (let c = 0; c < ENEMY_COLS; c++)
          this.enemies.push(new Enemy(c, r));
    }

    nextLevel() {
      this.level++;
      this.enemies = [];
      this.bullets = [];
      this.enemyShootTimer = 0;
      this.boss = null;
      this.levelTransition = 50;
      this._bounceLocked = false;
      this._prevMaxEnemyY = 0;
      this._bossNext = false;
      sfx.level_up();

      if (this.level % 5 === 0) {
        this.boss = new Boss(this.level);
        console.log('[SPACE INVADERS] BOSS spawn on level ' + this.level);
      } else {
        this.createEnemies();
        this.enemySpeed = (1.0 + (this.level - 1) * 0.15) * SPEED_FACTOR;
        this.enemyShootInterval = Math.max(12, 55 / SPEED_FACTOR - (this.level - 1) * 2);
        // Предупреждение о боссе на следующем уровне
        if ((this.level + 1) % 5 === 0) {
          this._bossNext = true;
        }
      }
      this.player.lives = Math.min(5, this.player.lives + 1);
    }

    resume() {
      this.state = 'playing';
      this.lastTime = performance.now();
      this._bounceLocked = false;
    }

    resize() {
      const maxW = window.innerWidth * 0.95;
      const maxH = window.innerHeight * 0.65;
      this.scale = Math.min(maxW / VIRTUAL_W, maxH / VIRTUAL_H, 1.2);
      this.canvas.width = VIRTUAL_W * this.scale;
      this.canvas.height = VIRTUAL_H * this.scale;
    }

    bindEvents() {
      window.addEventListener('resize', () => this.resize());

      window.addEventListener('keydown', (e) => {
        initAudio();
        if (e.key === 'ArrowLeft' || e.key === 'a')  { this.keys.left = true; e.preventDefault(); }
        if (e.key === 'ArrowRight' || e.key === 'd') { this.keys.right = true; e.preventDefault(); }
        if (e.key === ' ')  { this.keys.fire = true; e.preventDefault(); }
        if (e.key === 'r' || e.key === 'R') { this.keys.rocket = true; e.preventDefault(); }
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
          e.preventDefault();
          if (this.state === 'playing') this.state = 'paused';
          else if (this.state === 'paused') this.resume();
        }
      });

      window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a')  this.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
        if (e.key === ' ')  this.keys.fire = false;
        if (e.key === 'r' || e.key === 'R') this.keys.rocket = false;
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.state = 'paused';
      });

      this.canvas.addEventListener('click', () => {
        if (this.state === 'gameover') this.showGameOverPanel();
        else if (this.state === 'paused') this.resume();
      });

      this.saveBtn.addEventListener('click', () => this.saveScore());
      this.restartBtn.addEventListener('click', () => this.restart());
      this.nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.saveScore();
      });

      const addBtn = (id, prop) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('pointerdown', (e) => {
          initAudio();
          this.keys[prop] = true;
          e.preventDefault();
        });
        btn.addEventListener('pointerup', () => { this.keys[prop] = false; });
        btn.addEventListener('pointerleave', () => { this.keys[prop] = false; });
      };
      addBtn('btnLeft', 'left');
      addBtn('btnRight', 'right');
      addBtn('btnFire', 'fire');
      addBtn('btnRocket', 'rocket');

      const pauseBtn = document.getElementById('btnPause');
      if (pauseBtn) {
        pauseBtn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          initAudio();
          if (this.state === 'playing') this.state = 'paused';
          else if (this.state === 'paused') this.resume();
        });
      }

      this.helpBtn.addEventListener('click', () => this.toggleHelp());

      window.addEventListener('click', (e) => {
        if (this.helpVisible && !this.helpPanel.contains(e.target) && e.target !== this.helpBtn) {
          this.helpPanel.classList.remove('active');
          this.helpBtn.textContent = '?';
          this.helpVisible = false;
        }
      });

      if (this.musicBtn) {
        this.musicBtn.addEventListener('click', () => {
          initAudio();
          if (musicPlaying) {
            stopMusic();
            this.musicBtn.textContent = '🎵';
            this.musicBtn.classList.remove('music-on');
          } else {
            startMusic();
            this.musicBtn.textContent = '♫';
            this.musicBtn.classList.add('music-on');
          }
        });
      }
    }

    toggleHelp() {
      if (this.helpVisible) {
        this.helpPanel.classList.remove('active');
        this.helpBtn.textContent = '?';
      } else {
        this.helpPanel.classList.add('active');
        this.helpBtn.textContent = '×';
      }
      this.helpVisible = !this.helpVisible;
    }

    spawnParticles(x, y, color, count, speedMult = 1) {
      for (let i = 0; i < count; i++)
        this.particles.push(new Particle(x, y, color, speedMult));
    }

    spawnPowerUp(x, y) {
      const r = Math.random();
      let type;
      if (r < 0.60) type = 'rocket';
      else if (r < 0.80) type = 'nuke';
      else type = 'shield';
      this.powerups.push(new PowerUp(x, y, type));
    }

    applyPowerUp(pu) {
      if (pu.type === 'rocket') {
        this.player.giveRockets(2);
        sfx.pickup();
      } else if (pu.type === 'nuke') {
        if (this.boss && this.boss.alive) {
          this.boss.hp = Math.max(1, this.boss.hp - 8);
          this.boss.flashTimer = 8;
        }
        for (const e of this.enemies) {
          if (e.alive) {
            e.alive = false;
            this.score += 5;
            this.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#f80', 8, 1.5);
          }
        }
        this.shockwaves.push(new Shockwave(VIRTUAL_W / 2, VIRTUAL_H / 2));
        this.spawnParticles(VIRTUAL_W / 2, VIRTUAL_H / 2, '#fff', 40, 2.5);
        this.spawnParticles(VIRTUAL_W / 2, VIRTUAL_H / 2, '#ff0', 30, 2);
        this.shakeX = 10; this.shakeY = 8;
        this.flashAlpha = 0.4;
        sfx.nuke();
      } else if (pu.type === 'shield') {
        this.player.invincible = 180;
        sfx.pickup();
      }
    }

    enemyShoot() {
      const alive = this.enemies.filter(e => e.alive);
      if (alive.length === 0) return;
      const s = alive[Math.floor(Math.random() * alive.length)];
      this.bullets.push(new Bullet(s.x + s.w / 2, s.y + s.h, 0, ENEMY_BULLET_SPEED, true));
    }

    updateRocket(r, dt) {
      let target = null, minDist = Infinity;
      if (this.boss && this.boss.alive) {
        const d = Math.hypot(this.boss.x + this.boss.w / 2 - r.x, this.boss.y + this.boss.h / 2 - r.y);
        if (d < minDist) { minDist = d; target = { x: this.boss.x + this.boss.w / 2, y: this.boss.y + this.boss.h / 2, isBoss: true }; }
      }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x + e.w / 2 - r.x, e.y + e.h / 2 - r.y);
        if (d < minDist) { minDist = d; target = { x: e.x + e.w / 2, y: e.y + e.h / 2, isBoss: false }; }
      }
      if (target) {
        const dx = target.x - r.x, dy = target.y - r.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          r.vx += ((dx / dist) * ROCKET_SPEED - r.vx) * 0.12 * dt;
          r.vy += ((dy / dist) * ROCKET_SPEED - r.vy) * 0.12 * dt;
        }
      }
      r.update(dt);
    }

    // --- ЗАЩИТА: сброс позиций врагов на стартовые, если dt аномальный ---
    _resetEnemiesToStart() {
      const alive = this.enemies.filter(e => e.alive);
      for (let i = 0; i < alive.length; i++) {
        const row = Math.floor(i / ENEMY_COLS);
        const col = i % ENEMY_COLS;
        alive[i].x = 40 + col * (ENEMY_W + ENEMY_PAD);
        alive[i].y = ENEMY_START_Y + row * (ENEMY_H + ENEMY_PAD);
      }
      this._prevMaxEnemyY = 0;
    }

    // --- ЗАЩИТА: проверка аномального спуска врагов ---
    _checkEnemyDescent() {
      let maxY = 0;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.y > maxY) maxY = e.y;
      }
      if (this._prevMaxEnemyY > 0) {
        const descent = maxY - this._prevMaxEnemyY;
        if (descent > 30) {
          console.warn(
            '[SPACE INVADERS] АНОМАЛИЯ: враги спустились на ' + descent.toFixed(1) +
            'px за кадр! dt=' + this.dt.toFixed(2) +
            ' speed=' + this.enemySpeed.toFixed(2) +
            ' level=' + this.level +
            ' bounceLocked=' + this._bounceLocked
          );
          // Принудительный возврат на штатные позиции
          this._resetEnemiesToStart();
          maxY = ENEMY_START_Y + (ENEMY_ROWS - 1) * (ENEMY_H + ENEMY_PAD);
        }
      }
      this._prevMaxEnemyY = maxY;
    }

    update() {
      if (this.state !== 'playing') return;

      const dt = this.dt;
      const p = this.player;

      // ЗАЩИТА: если dt подозрительно большой — сбрасываем bounce lock и позиции
      if (dt > 2.2) {
        this._bounceLocked = false;
        this._resetEnemiesToStart();
      }

      p.update(this.keys, dt);
      this.updateStars(dt);

      if (this.shakeX !== 0 || this.shakeY !== 0) {
        this.shakeX *= -0.65; this.shakeY *= -0.65;
        if (Math.abs(this.shakeX) < 0.3) this.shakeX = 0;
        if (Math.abs(this.shakeY) < 0.3) this.shakeY = 0;
      }
      if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - 0.04 * dt);
      if (this.levelTransition > 0) this.levelTransition -= dt;

      // Fire
      if (this.keys.fire && this.fireCooldown <= 0) {
        this.bullets.push(new Bullet(p.x + p.w / 2, p.y, 0, BULLET_SPEED, false));
        sfx.shoot();
        this.fireCooldown = 14;
      }
      if (this.fireCooldown > 0) this.fireCooldown -= dt;

      // Rockets
      if (this.keys.rocket && p.rockets > 0) {
        this.bullets.push(new Rocket(p.x + p.w / 2, p.y - 6));
        p.rockets--;
        sfx.rocket_launch();
        this.keys.rocket = false;
      }

      // Boss
      if (this.boss && this.boss.alive) {
        this.boss.update(dt, this.bullets, p.x + p.w / 2);
      }

      // Enemy movement — с тройной защитой от аномалий
      if (!this.boss || !this.boss.alive || this.boss.enterTimer >= this.boss.enterDuration) {
        // Запоминаем Y до движения для отладки
        for (const e of this.enemies) {
          if (e.alive) e.prevY = e.y;
        }

        // Горизонтальное движение
        let edge = false;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          e.x += this.enemyDir * this.enemySpeed * dt;
          if (e.x <= 0 || e.x + e.w >= VIRTUAL_W) edge = true;
        }

        // Шаг вниз — только ОДИН раз за кадр (bounceLock)
        if (edge && !this._bounceLocked) {
          this._bounceLocked = true;
          this.enemyDir *= -1;
          // HARD CAP: не более 12px спуска за кадр
          const step = Math.min(this.enemyStepDown, 12);
          for (const e of this.enemies) {
            if (e.alive) e.y += step;
          }
        } else if (!edge) {
          this._bounceLocked = false;
        }

        // ЗАЩИТА: проверка аномального спуска
        this._checkEnemyDescent();

        this.enemyShootTimer += dt;
        if (this.enemyShootTimer >= this.enemyShootInterval) {
          this.enemyShootTimer = 0;
          this.enemyShoot();
        }
      }

      // Update objects
      for (const b of this.bullets) {
        if (b instanceof Rocket) this.updateRocket(b, dt);
        else b.update(dt);
      }
      for (const pu of this.powerups) pu.update(dt);
      for (const sw of this.shockwaves) sw.update(dt);
      for (const pt of this.particles) pt.update(dt);
      this.particles = this.particles.filter(pt => pt.alive);
      this.shockwaves = this.shockwaves.filter(sw => sw.alive);

      // === Player bullet vs enemies ===
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.isEnemy) continue;

        if (b instanceof Rocket) {
          let hitBoss = false, hitEnemy = false;
          if (this.boss && this.boss.alive &&
              b.x > this.boss.x && b.x < this.boss.x + this.boss.w &&
              b.y > this.boss.y && b.y < this.boss.y + this.boss.h) {
            hitBoss = true;
            this.spawnParticles(b.x, b.y, '#ff0', 20, 1.5);
            this.spawnParticles(b.x, b.y, '#f80', 12, 1);
            sfx.boss_hit();
            const dead = this.boss.hit(5);
            if (dead) {
              this.spawnParticles(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, '#fff', 50, 3);
              this.spawnParticles(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, '#f80', 30, 2);
              this.spawnParticles(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, '#f00', 20, 2.5);
              this.shockwaves.push(new Shockwave(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, VIRTUAL_W * 0.5));
              this.shakeX = 12; this.shakeY = 10;
              this.flashAlpha = 0.5;
              this.score += 100;
              sfx.boss_death();
              this.spawnPowerUp(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2);
              this.spawnPowerUp(this.boss.x + this.boss.w / 4, this.boss.y + this.boss.h / 2);
            }
          }
          for (const e of this.enemies) {
            if (!e.alive) continue;
            if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
              hitEnemy = true;
              this.spawnParticles(b.x, b.y, '#ff0', 18, 1.5);
              this.spawnParticles(b.x, b.y, '#f80', 10, 1);
              sfx.rocket_boom();
              for (const enemy of this.enemies) {
                if (!enemy.alive) continue;
                if (Math.hypot(enemy.x + enemy.w / 2 - b.x, enemy.y + enemy.h / 2 - b.y) < AOE_RADIUS) {
                  enemy.alive = false;
                  this.score += 10;
                  this.spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#f0f', 6);
                }
              }
              break;
            }
          }
          if (hitBoss || hitEnemy || b.isOffScreen()) {
            if (hitBoss || hitEnemy) sfx.rocket_boom();
            if (!hitBoss && !hitEnemy && b.isOffScreen())
              this.spawnParticles(b.x, b.y, '#ff0', 5, 0.5);
            this.bullets.splice(i, 1);
          }
          continue;
        }

        // Bullet vs boss
        if (this.boss && this.boss.alive &&
            b.x > this.boss.x && b.x < this.boss.x + this.boss.w &&
            b.y > this.boss.y && b.y < this.boss.y + this.boss.h) {
          this.boss.hit(1);
          sfx.boss_hit();
          this.spawnParticles(b.x, b.y, '#ff0', 3, 0.5);
          this.bullets.splice(i, 1);
          continue;
        }
        // Bullet vs enemies
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
            e.alive = false;
            this.score += 10;
            sfx.hit();
            this.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#f0f', 8);
            if (Math.random() < 0.25) this.spawnPowerUp(e.x + e.w / 2, e.y);
            this.bullets.splice(i, 1);
            break;
          }
        }
        if (i < this.bullets.length && this.bullets[i] === b && b.isOffScreen())
          this.bullets.splice(i, 1);
      }

      // === Enemy bullets vs player ===
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (!b.isEnemy) continue;
        if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) {
          const dead = p.hitEnemy();
          sfx.death();
          this.spawnParticles(p.x + p.w / 2, p.y + p.h / 2, '#0ff', 12);
          this.shakeX = 4; this.shakeY = 3;
          this.bullets.splice(i, 1);
          if (dead) {
            this.state = 'gameover';
            this.flashAlpha = 0.6;
            stopMusic();
            setTimeout(() => this.showGameOverPanel(), 600);
            return;
          }
        } else if (b.isOffScreen()) {
          this.bullets.splice(i, 1);
        }
      }

      // === Powerups vs player ===
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        if (!pu.alive) { this.powerups.splice(i, 1); continue; }
        if (pu.x + pu.w > p.x && pu.x < p.x + p.w && pu.y + pu.h > p.y && pu.y < p.y + p.h) {
          this.applyPowerUp(pu);
          this.powerups.splice(i, 1);
        }
      }

      // === Enemies reached player? ===
      for (const e of this.enemies) {
        if (e.alive && e.y + e.h >= p.y - 5) {
          console.warn(
            '[SPACE INVADERS] Враг достиг игрока! y=' + e.y.toFixed(1) +
            ' playerY=' + p.y + ' dt=' + dt.toFixed(2) +
            ' level=' + this.level
          );
          this.state = 'gameover';
          sfx.death();
          this.flashAlpha = 0.5;
          stopMusic();
          setTimeout(() => this.showGameOverPanel(), 600);
          return;
        }
      }

      // === Level transition ===
      if (this.boss) {
        if (!this.boss.alive) this.nextLevel();
      } else if (this.enemies.length > 0 && this.enemies.every(e => !e.alive)) {
        this.nextLevel();
      }
    }

    draw() {
      const ctx = this.ctx;
      const s = this.scale;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.save();
      ctx.scale(s, s);
      ctx.translate(this.shakeX, this.shakeY);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      for (const star of this.bgStars) {
        const twinkle = 0.5 + 0.5 * Math.sin(performance.now() * 0.003 + star.x * 100);
        ctx.fillStyle = `rgba(255,255,255,${(0.4 + star.size * 0.2) * twinkle})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }

      for (const e of this.enemies) e.draw(ctx);
      if (this.boss) this.boss.draw(ctx);
      for (const b of this.bullets) b.draw(ctx);
      for (const pu of this.powerups) pu.draw(ctx);
      for (const sw of this.shockwaves) sw.draw(ctx);
      for (const pt of this.particles) pt.draw(ctx);
      this.player.draw(ctx);

      if (this.flashAlpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flashAlpha})`;
        ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      }

      if (this.levelTransition > 0) {
        const a = Math.min(1, this.levelTransition / 20);
        ctx.fillStyle = `rgba(0,0,0,${a * 0.4})`;
        ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.font = '22px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('LEVEL ' + this.level, VIRTUAL_W / 2, VIRTUAL_H / 2 + (1 - a) * 30);
        if (this.boss) {
          ctx.fillStyle = '#f44';
          ctx.font = '18px "Courier New"';
          ctx.fillText('⚠ BOSS ⚠', VIRTUAL_W / 2, VIRTUAL_H / 2 + 30 + (1 - a) * 20);
        }
        ctx.textAlign = 'start';
      }

      // HUD
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px "Courier New"';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 3;
      ctx.fillText('Score: ' + this.score, 10, 18);
      ctx.fillText('❤️'.repeat(this.player.lives), VIRTUAL_W - 100, 18);
      ctx.fillText('Lvl ' + this.level, VIRTUAL_W / 2 - 28, 18);
      if (this.player.rockets > 0)
        ctx.fillText('🚀×' + this.player.rockets, VIRTUAL_W - 58, VIRTUAL_H - 8);
      ctx.shadowBlur = 0;

      // Boss HP bar
      if (this.boss && this.boss.alive && this.boss.enterTimer >= this.boss.enterDuration) {
        const bW = VIRTUAL_W - 80, bH = 10, bX = 40, bY = 7;
        ctx.fillStyle = '#222';
        ctx.fillRect(bX - 1, bY - 1, bW + 2, bH + 2);
        const hpR = Math.max(0, this.boss.hp / this.boss.maxHp);
        const grad = ctx.createLinearGradient(bX, bY, bX + bW, bY);
        grad.addColorStop(0, '#f33'); grad.addColorStop(0.4, '#ff0'); grad.addColorStop(1, '#0f0');
        ctx.fillStyle = grad;
        ctx.fillRect(bX, bY, bW * hpR, bH);
        ctx.fillStyle = '#fff';
        ctx.font = '8px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS  ' + this.boss.hp + '/' + this.boss.maxHp, VIRTUAL_W / 2, bY - 2);
        ctx.textAlign = 'start';
      }

      // Pause
      if (this.state === 'paused') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 28px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ PAUSED', VIRTUAL_W / 2, VIRTUAL_H / 2 - 10);
        ctx.font = '14px "Courier New"';
        ctx.fillText('Tap or press P to resume', VIRTUAL_W / 2, VIRTUAL_H / 2 + 22);
        ctx.textAlign = 'start';
      }

      ctx.restore();
    }

    loop(timestamp) {
      const rawDt = (timestamp - this.lastTime) / 16.667;

      // ЗАЩИТА: обнаружен гигантский скачок времени (> 5 кадров)
      if (rawDt > 5) {
        if (this.state === 'playing') {
          console.warn('[SPACE INVADERS] rawDt=' + rawDt.toFixed(1) + ' — кадр пропущен');
        }
        this.lastTime = timestamp;
        this._bounceLocked = false;
        this.draw();
        requestAnimationFrame(ts => this.loop(ts));
        return;
      }

      this.dt = Math.max(0.05, Math.min(rawDt, 3));
      this.lastTime = timestamp;
      this.update();
      this.draw();
      requestAnimationFrame(ts => this.loop(ts));
    }

    showGameOverPanel() {
      this.guiPanel.style.display = 'block';
      this.finalScoreSpan.textContent = this.score;
      this.nameInput.value = '';
      this.leaderboardDiv.innerHTML = '';
      this.nameInput.focus();
    }

    restart() {
      this.guiPanel.style.display = 'none';
      this.saveBtn.disabled = false;
      this.saveBtn.textContent = '💾 Сохранить';
      this.resetGame();
      this.lastTime = performance.now();
    }

    saveScore() {
      const name = this.nameInput.value.trim();
      if (!name || name.length > 50) {
        this.saveBtn.textContent = 'Введите имя (1–50)';
        setTimeout(() => { if (!this.saveBtn.disabled) this.saveBtn.textContent = '💾 Сохранить'; }, 1500);
        return;
      }
      this.saveBtn.disabled = true;
      this.saveBtn.textContent = '✅ Сохранено';

      const data = { name, score: this.score, level: this.level };
      const saved = JSON.parse(localStorage.getItem('spaceScores') || '[]');
      saved.push(data);
      saved.sort((a, b) => b.score - a.score);
      const top10 = saved.slice(0, 10);
      localStorage.setItem('spaceScores', JSON.stringify(top10));
      this.showLeaderboard(top10);
    }

    showLeaderboard(list) {
      if (!list.length) {
        this.leaderboardDiv.innerHTML = '<p>Пока нет результатов</p>';
        return;
      }
      let html = '<h3>🏆 Таблица лидеров</h3><ol>';
      list.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        html += '<li>' + medal + ' ' + this._esc(p.name) + ' — <b>' + p.score + '</b>';
        if (p.level) html += ' (ур. ' + p.level + ')';
        html += '</li>';
      });
      html += '</ol>';
      this.leaderboardDiv.innerHTML = html;
    }

    _esc(s) {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(s).replace(/[&<>"']/g, m => map[m]);
    }
  }

  const canvas = document.getElementById('gameCanvas');
  if (canvas) new Game(canvas);
})();
