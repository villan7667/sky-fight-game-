// ========================================
// SKY FIGHTER - Enhanced Responsive Game
// ========================================

// Audio Manager with Web Audio API
class AudioManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    }

    toggle() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('soundEnabled', this.soundEnabled);
        return this.soundEnabled;
    }

    playSound(frequency, duration, type = 'shoot') {
        if (!this.soundEnabled) return;
        
        try {
            const now = this.audioContext.currentTime;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, now);
            osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, now + duration);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {
            console.log('[v0] Audio error:', e.message);
        }
    }

    playShootSound() {
        this.playSound(400, 0.1, 'shoot');
    }

    playHitSound() {
        this.playSound(300, 0.15, 'hit');
    }

    playEnemyDestroyedSound() {
        this.playSound(600, 0.3, 'destroy');
    }

    playCollectSound() {
        this.playSound(800, 0.2, 'collect');
    }

    playPlayerDeadSound() {
        this.playSound(400, 0.5, 'dead');
    }

    playGameOverSound() {
        this.playSound(200, 0.8, 'gameover');
    }

    playWaveStartSound() {
        this.playSound(300, 0.3, 'wave');
    }

    playBossSound() {
        this.playSound(150, 0.4, 'boss');
    }
}

// Game State
const game = {
    player: {
        x: 0,
        y: 0,
        width: 30,
        height: 40,
        health: 100,
        invulnerable: 0,
    },
    enemies: [],
    bullets: [],
    collectibles: [],
    particles: [],
    score: 0,
    bestScore: localStorage.getItem('bestScore') ? parseInt(localStorage.getItem('bestScore')) : 0,
    lives: 3,
    level: 1,
    waveCount: 0,
    gameTime: 0,
    gameState: 'playing',
    bossActive: false,
    isPaused: false,
};

// Canvas and Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioManager = new AudioManager();

// UI Elements
const scoreDisplay = document.getElementById('scoreDisplay');
const bestDisplay = document.getElementById('bestDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const levelDisplay = document.getElementById('levelDisplay');
const overlay = document.getElementById('gameOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const playBtn = document.getElementById('playBtn');
const resumeBtn = document.getElementById('resumeBtn');
const quitBtn = document.getElementById('quitBtn');
const overlayTitle = document.getElementById('overlayTitle');
const finalScore = document.getElementById('finalScore');
const bestScore = document.getElementById('bestScore');
const levelReached = document.getElementById('levelReached');
const waveIndicator = document.getElementById('waveIndicator');
const soundBtn = document.getElementById('soundBtn');
const mobileControls = document.getElementById('mobileControls');
const pauseBtn = document.getElementById('pauseBtn');

// Input Management
const keys = {};
const touchInput = {
    moving: { x: 0, y: 0 },
    shooting: false,
};

// Keyboard Input
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') {
        e.preventDefault();
        shoot();
    }
    if (e.key.toLowerCase() === 'p') {
        togglePause();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Mobile D-Pad Controls
const dpadButtons = {
    up: document.getElementById('upBtn'),
    down: document.getElementById('downBtn'),
    left: document.getElementById('leftBtn'),
    right: document.getElementById('rightBtn'),
};

Object.entries(dpadButtons).forEach(([direction, btn]) => {
    if (btn) {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[direction] = true;
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[direction] = false;
        });
        btn.addEventListener('mousedown', () => {
            keys[direction] = true;
        });
        btn.addEventListener('mouseup', () => {
            keys[direction] = false;
        });
        btn.addEventListener('mouseleave', () => {
            keys[direction] = false;
        });
    }
});

// Virtual Joystick
const joystick = document.getElementById('joystick');
const joystickBg = document.querySelector('.joystick-bg');
let joystickActive = false;

function initJoystick() {
    if (!joystickBg || !joystick) return;

    const joystickHandler = (e) => {
        e.preventDefault();
        const touches = e.touches || [e];
        const touch = touches[0];
        const rect = joystickBg.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxDistance = rect.width / 2 - 20;

        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const distance = Math.min(maxDistance, Math.sqrt(dx * dx + dy * dy));
        const angle = Math.atan2(dy, dx);

        const moveX = Math.cos(angle) * distance;
        const moveY = Math.sin(angle) * distance;

        joystick.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
        
        touchInput.moving.x = moveX / maxDistance;
        touchInput.moving.y = moveY / maxDistance;
    };

    const joystickEnd = () => {
        joystickActive = false;
        joystick.classList.remove('active');
        joystick.style.transform = 'translate(-50%, -50%)';
        touchInput.moving = { x: 0, y: 0 };
    };

    joystickBg.addEventListener('touchstart', () => {
        joystickActive = true;
        joystick.classList.add('active');
    });
    joystickBg.addEventListener('touchmove', joystickHandler);
    joystickBg.addEventListener('touchend', joystickEnd);
    joystickBg.addEventListener('touchcancel', joystickEnd);

    joystickBg.addEventListener('mousedown', () => {
        joystickActive = true;
        joystick.classList.add('active');
    });
    joystickBg.addEventListener('mousemove', joystickHandler);
    joystickBg.addEventListener('mouseup', joystickEnd);
    joystickBg.addEventListener('mouseleave', joystickEnd);
}

// Shoot Button
const shootBtn = document.getElementById('shootBtn');
if (shootBtn) {
    shootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        shoot();
    });
    shootBtn.addEventListener('mousedown', (e) => {
        shoot();
    });
}

// Sound Toggle
if (soundBtn) {
    soundBtn.addEventListener('click', () => {
        const enabled = audioManager.toggle();
        soundBtn.style.opacity = enabled ? '1' : '0.4';
    });
    soundBtn.style.opacity = audioManager.soundEnabled ? '1' : '0.4';
}

// Pause Controls
if (pauseBtn) {
    pauseBtn.addEventListener('click', togglePause);
}

if (resumeBtn) {
    resumeBtn.addEventListener('click', togglePause);
}

if (quitBtn) {
    quitBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// Responsive Canvas
function resizeCanvas() {
    const wrapper = canvas.parentElement;
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    game.player.y = canvas.height - 100;
    if (game.player.x === 0) game.player.x = canvas.width / 2 - 15;
}

// Mobile Controls Toggle
function updateMobileControls() {
    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 600;
    const controlsInfo = document.getElementById('controlsInfo');
    
    if (isMobile) {
        mobileControls.classList.add('active');
        if (controlsInfo) controlsInfo.style.display = 'none';
    } else {
        mobileControls.classList.remove('active');
        if (controlsInfo) controlsInfo.style.display = 'block';
    }
    
    resizeCanvas();
}

resizeCanvas();
updateMobileControls();
window.addEventListener('resize', updateMobileControls);
window.addEventListener('orientationchange', updateMobileControls);

// Toggle Pause
function togglePause() {
    if (game.gameState !== 'playing') return;
    
    game.isPaused = !game.isPaused;
    pauseOverlay.classList.toggle('active', game.isPaused);
}

// Utility Functions
function checkCollision(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function createParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 2 + Math.random() * 2;
        game.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30,
            color: color,
        });
    }
}

function screenShake(intensity = 5, duration = 10) {
    game.screenShake = { intensity, duration, elapsed: 0 };
}

// Player Shooting
function shoot() {
    if (game.gameState !== 'playing' || game.isPaused) return;
    
    game.bullets.push({
        x: game.player.x + game.player.width / 2 - 2,
        y: game.player.y - 10,
        width: 4,
        height: 15,
        vx: 0,
        vy: -8,
        isPlayerBullet: true,
    });
    audioManager.playShootSound();
}

// Spawn Collectible
function spawnCollectible() {
    if (Math.random() < 0.08) {
        game.collectibles.push({
            x: Math.random() * (canvas.width - 20),
            y: -20,
            width: 15,
            height: 15,
            vx: (Math.random() - 0.5) * 2,
            vy: 2 + Math.random() * 2,
            life: 180,
        });
    }
}

// Spawn Regular Enemy
function spawnEnemy() {
    game.enemies.push({
        x: Math.random() * (canvas.width - 30),
        y: -30,
        width: 30,
        height: 30,
        vx: (Math.random() - 0.5) * (1 + game.level * 0.2),
        vy: 1 + Math.random() * (0.5 + game.level * 0.2),
        health: 30 + game.level * 10,
        shootCooldown: Math.random() * 60 + 30 - game.level * 5,
        isBoss: false,
        type: 'regular',
        points: 100,
    });
}
// Spawn Medium Enemy
function spawnMediumEnemy() {
    game.enemies.push({
        x: Math.random() * (canvas.width - 50),
        y: -50,
        width: 50,
        height: 45,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0.8 + Math.random() * 0.5,
        health: 80 + game.level * 20,
        shootCooldown: Math.random() * 40 + 20,
        isBoss: false,
        type: 'medium',
        points: 200,
    });
}
// Spawn Flying Enemy
function spawnFlyingEnemy() {
    game.enemies.push({
        x: Math.random() * (canvas.width - 25),
        y: -25,
        width: 25,
        height: 25,
        vx: (Math.random() - 0.5) * 4,
        vy: 2.5 + Math.random() * 1.5,
        health: 15 + game.level * 5,
        shootCooldown: Math.random() * 80 + 40,
        isBoss: false,
        type: 'flying',
        points: 150,
        baseX: 0,
        sineOffset: Math.random() * Math.PI * 2,
    });
}
// Spawn Boss Enemy (Using Bootstrap Icons)
function spawnBoss() {
    if (!game.bossActive) {
        game.bossActive = true;
        game.enemies.push({
            x: canvas.width / 2 - 50,
            y: 50,
            width: 100,
            height: 60,
            vx: 0,
            vy: 0,
            health: 200 + game.level * 100,
            shootCooldown: 5,
            isBoss: true,
        });
        audioManager.playBossSound();
        waveIndicator.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> RED DESTROYER INCOMING <i class="bi bi-exclamation-triangle-fill"></i>';
        waveIndicator.classList.add('active');
        screenShake(8, 20);
        setTimeout(() => waveIndicator.classList.remove('active'), 3000);
    }
}


// Spawn Wave
function spawnWave() {
    const enemyCount = 3 + Math.floor(game.level * 1.5);
    for (let i = 0; i < enemyCount; i++) {
        const timeElapsed = game.gameTime > 3600;
        if ((game.level >= 1 && Math.random() < 0.15) || timeElapsed) {
            if (Math.random() < 0.5) {
                spawnMediumEnemy();
            } else {
                spawnFlyingEnemy();
            }
        } else {
            spawnEnemy();
        }
    }
    game.waveCount++;
    audioManager.playWaveStartSound();
    waveIndicator.innerHTML = `<i class="bi bi-flag-fill"></i> Wave ${game.waveCount}`;
    waveIndicator.classList.add('active');
    setTimeout(() => waveIndicator.classList.remove('active'), 1500);

    if (game.level >= 2 && game.waveCount % 3 === 0) {
        spawnBoss();
    }
}




// Update Lives Display 
function updateLivesDisplay() {
    const livesHTML = '♥'.repeat(Math.max(0, game.lives));
    livesDisplay.innerHTML = livesHTML.split('').map(h => `<span class="life-icon"><i class="bi bi-heart-fill" style="color: #ff3366;"></i></span>`).join('');
}


// Update Score Display
function updateScoreDisplay() {
    scoreDisplay.textContent = game.score;
    bestDisplay.textContent = game.bestScore;
    levelDisplay.textContent = game.level;
}

// Game Over
function gameOver() {
    game.gameState = 'gameOver';
    audioManager.playGameOverSound();
    overlayTitle.textContent = 'GAME OVER';
    finalScore.textContent = game.score;
    bestScore.textContent = game.bestScore;
    levelReached.textContent = game.level;
    overlay.classList.add('active');
}

// Reset Game
function resetGame() {
    game.player = {
        x: canvas.width / 2 - 15,
        y: canvas.height - 100,
        width: 30,
        height: 40,
        health: 100,
        invulnerable: 120,
    };
    game.enemies = [];
    game.bullets = [];
    game.collectibles = [];
    game.particles = [];
    game.score = 0;
    game.lives = 3;
    game.level = 1;
    game.waveCount = 0;
    game.gameTime = 0;
    game.gameState = 'playing';
    game.bossActive = false;
    game.isPaused = false;
    updateLivesDisplay();
    updateScoreDisplay();
    overlay.classList.remove('active');
    pauseOverlay.classList.remove('active');
    spawnWave();
}

// Main Game Loop
function gameLoop() {
    if (game.isPaused || game.gameState !== 'playing') {
        requestAnimationFrame(gameLoop);
        return;
    }

    game.gameTime++;

    // Decrease invulnerability
    game.player.invulnerable = Math.max(0, game.player.invulnerable - 1);

    // Player Movement from Keyboard/D-Pad
    const moveSpeed = canvas.width > 500 ? 5 : 3;
    if (keys['arrowup'] || keys['w'] || keys['up']) {
        game.player.y = Math.max(0, game.player.y - moveSpeed);
    }
    if (keys['arrowdown'] || keys['s'] || keys['down']) {
        game.player.y = Math.min(canvas.height - game.player.height, game.player.y + moveSpeed);
    }
    if (keys['arrowleft'] || keys['a'] || keys['left']) {
        game.player.x = Math.max(0, game.player.x - moveSpeed);
    }
    if (keys['arrowright'] || keys['d'] || keys['right']) {
        game.player.x = Math.min(canvas.width - game.player.width, game.player.x + moveSpeed);
    }

    // Player Movement from Joystick
    if (Math.abs(touchInput.moving.x) > 0.1 || Math.abs(touchInput.moving.y) > 0.1) {
        game.player.x = Math.max(0, Math.min(canvas.width - game.player.width, game.player.x + touchInput.moving.x * moveSpeed));
        game.player.y = Math.max(0, Math.min(canvas.height - game.player.height, game.player.y + touchInput.moving.y * moveSpeed));
    }

   // Spawn new wave if all enemies defeated (with delay)
if (game.enemies.length === 0 && !game.wavePending) {
    game.wavePending = true;
    game.level++;
    updateScoreDisplay();
    setTimeout(() => {
        spawnWave();
        game.wavePending = false;
    }, 1500); // 1.5 second break between waves
}


        // Spawn collectibles
        spawnCollectible();

        // Force spawn medium and flying enemies over time (~2 minutes) even if level hasn't increased
        if (game.gameTime > 3600 && game.gameTime % 300 === 0) {
            if (Math.random() < 0.5) {
                spawnMediumEnemy();
            } else {
                spawnFlyingEnemy();
            }
        }
    
// Update Enemies
game.enemies.forEach((enemy) => {
    if (!enemy.isBoss) {
        if (enemy.type === 'flying') {
            if (!enemy.baseX) enemy.baseX = enemy.x;
            enemy.baseX += enemy.vx * 0.5;
            enemy.x = enemy.baseX + Math.sin(game.gameTime * 0.05 + enemy.sineOffset) * 40;
            enemy.y += enemy.vy;
        } else {
            enemy.x += enemy.vx;
            enemy.y += enemy.vy;
            // No wall collision - they pass through
        }
    } else {
        // Only the boss bounces off side walls
        enemy.x += enemy.vx;
        if (enemy.x <= 0 || enemy.x + enemy.width >= canvas.width) {
            enemy.vx = enemy.vx === 0 ? 1 : -enemy.vx;
        }
    }

    // Enemy Shooting (Enhanced: scales better with level)
    enemy.shootCooldown--;
    if (enemy.shootCooldown <= 0) {
        const bulletCount = enemy.isBoss ? 3 : 1;
        for (let i = 0; i < bulletCount; i++) {
            const spread = enemy.isBoss ? (i - 1) * 0.5 : 0;
            game.bullets.push({
                x: enemy.x + enemy.width / 2 - 2,
                y: enemy.y + enemy.height,
                width: 4,
                height: 12,
                vx: spread,
                vy: 4 + game.level * 0.5,
                isPlayerBullet: false,
            });
        }
        enemy.shootCooldown = enemy.isBoss ? 8 : Math.random() * 80 + 60 - game.level * 5;
    }
});



    // Update Bullets
    game.bullets = game.bullets.filter((bullet) => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        return bullet.y > -20 && bullet.y < canvas.height + 20 && bullet.x > -20 && bullet.x < canvas.width + 20;
    });

// Update Collectibles
game.collectibles = game.collectibles.filter((collectible) => {
    collectible.x += collectible.vx;
    collectible.y += collectible.vy;
    collectible.life--; 
  
    return collectible.y < canvas.height + 30 && collectible.life > 0 && collectible.x > -50 && collectible.x < canvas.width + 50;
});

// Clean up enemies that fly off-screen (pass through borders)
game.enemies = game.enemies.filter((enemy) => {
    if (enemy.isBoss) return true; 
    return enemy.y < canvas.height + 60 && enemy.x > -100 && enemy.x < canvas.width + 100;
});


    // Update Particles
    game.particles = game.particles.filter((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.1; // gravity
        particle.life--;
        return particle.life > 0;
    });

// Collision Detection - Player Bullets vs Enemies
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        if (!game.bullets[i].isPlayerBullet) continue;

        for (let j = game.enemies.length - 1; j >= 0; j--) {
            if (checkCollision(game.bullets[i], game.enemies[j])) {
                game.enemies[j].health -= 30;
                const bulletX = game.bullets[i].x;
                const bulletY = game.bullets[i].y;
                game.bullets.splice(i, 1);
                createParticles(bulletX, game.enemies[j].y, '#ff3366', 5);
                audioManager.playHitSound();

                if (game.enemies[j].health <= 0) {
                    const enemy = game.enemies[j];
                    const points = enemy.isBoss ? 1000 : (enemy.points || 100);
                    game.score += points;
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ffff00', 15);
                    screenShake(5, 10);
                    updateScoreDisplay();

                    if (enemy.isBoss) {
                        game.bossActive = false;
                    }
                    game.enemies.splice(j, 1);
                    audioManager.playEnemyDestroyedSound();
                }
                break;
            }
        }
    }

   

    // Collision Detection - Player vs Collectibles
    for (let i = game.collectibles.length - 1; i >= 0; i--) {
        if (checkCollision(game.player, game.collectibles[i])) {
            game.score += 50;
            createParticles(game.collectibles[i].x, game.collectibles[i].y, '#ffff00', 8);
            updateScoreDisplay();
            game.collectibles.splice(i, 1);
            audioManager.playCollectSound();
        }
    }

    // Collision Detection - Enemy Bullets vs Player
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        if (game.bullets[i].isPlayerBullet) continue;

        if (checkCollision(game.bullets[i], game.player) && game.player.invulnerable === 0) {
            game.player.health -= 20;
            game.bullets.splice(i, 1);
            game.player.invulnerable = 120;
            createParticles(game.player.x + game.player.width / 2, game.player.y, '#ff0000', 10);
            screenShake(3, 8);
            audioManager.playHitSound();

            if (game.player.health <= 0) {
                game.lives--;
                updateLivesDisplay();
                audioManager.playPlayerDeadSound();

                if (game.lives <= 0) {
                    if (game.score > game.bestScore) {
                        game.bestScore = game.score;
                        localStorage.setItem('bestScore', game.bestScore);
                    }
                    gameOver();
                } else {
                    game.player.health = 100;
                    game.player.x = canvas.width / 2 - 15;
                    game.player.y = canvas.height - 100;
                    game.player.invulnerable = 120;
                    game.bullets = game.bullets.filter((b) => !b.isPlayerBullet);
                }
            }
        }
    }

    // Draw Everything
    drawGame();
    requestAnimationFrame(gameLoop);
}

// Draw Game
function drawGame() {
    // Clear canvas
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply screen shake
    if (game.screenShake && game.screenShake.elapsed < game.screenShake.duration) {
        const shake = game.screenShake.intensity * (1 - game.screenShake.elapsed / game.screenShake.duration);
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        game.screenShake.elapsed++;
    }

    // Draw Stars
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 50; i++) {
        const x = (game.gameTime * 0.3 + i * 60) % canvas.width;
        const y = (i * 70) % canvas.height;
        ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Draw Collectibles
    game.collectibles.forEach((collectible) => {
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(collectible.x + collectible.width / 2, collectible.y + collectible.height / 2, collectible.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow ring
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(collectible.x + collectible.width / 2, collectible.y + collectible.height / 2, collectible.width / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    });
// Draw Enemies
    game.enemies.forEach((enemy) => {
        if (enemy.isBoss) {
            // Boss
            ctx.fillStyle = '#ff0000';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 20;
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            
            // Boss details
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(enemy.x + enemy.width * 0.2, enemy.y + 10, enemy.width * 0.6, 20);
            
            // Health bar
            const barWidth = enemy.width;
            const barHeight = 6;
            ctx.fillStyle = '#ff3366';
            ctx.fillRect(enemy.x, enemy.y - 18, barWidth, barHeight);
            const healthPercent = Math.max(0, enemy.health / (200 + game.level * 100));
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(enemy.x, enemy.y - 18, barWidth * healthPercent, barHeight);
            
            // Glow effect
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.strokeRect(enemy.x - 2, enemy.y - 2, enemy.width + 4, enemy.height + 4);
            ctx.shadowBlur = 0;
        } else if (enemy.type === 'medium') {
            // Medium enemy (Diamond shape)
            ctx.fillStyle = '#ff8800';
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.moveTo(enemy.x + enemy.width / 2, enemy.y);
            ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height / 2);
            ctx.lineTo(enemy.x + enemy.width / 2, enemy.y + enemy.height);
            ctx.lineTo(enemy.x, enemy.y + enemy.height / 2);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (enemy.type === 'flying') {
            // Flying enemy (X-Wing shape)
            ctx.fillStyle = '#aa00ff';
            ctx.shadowColor = '#aa00ff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(enemy.x + enemy.width / 2, enemy.y + enemy.height);
            ctx.lineTo(enemy.x + enemy.width, enemy.y);
            ctx.lineTo(enemy.x + enemy.width * 0.75, enemy.y + enemy.height * 0.4);
            ctx.lineTo(enemy.x + enemy.width * 0.25, enemy.y + enemy.height * 0.4);
            ctx.lineTo(enemy.x, enemy.y);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            // Regular enemy
            ctx.fillStyle = '#ff3366';
            ctx.shadowColor = '#ff3366';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(enemy.x + enemy.width / 2, enemy.y);
            ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height);
            ctx.lineTo(enemy.x, enemy.y + enemy.height);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    });

    // Draw Bullets
    game.bullets.forEach((bullet) => {
        if (bullet.isPlayerBullet) {
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
        } else {
            ctx.fillStyle = '#ff0000';
            ctx.shadowColor = '#ff0000';
        }
        ctx.shadowBlur = 8;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        ctx.shadowBlur = 0;
    });

    // Draw Particles
    game.particles.forEach((particle) => {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life / 30;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Player
    if (game.player.invulnerable === 0 || Math.floor(game.player.invulnerable / 10) % 2 === 0) {
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 15;
        
        // Player ship
        ctx.beginPath();
        ctx.moveTo(game.player.x + game.player.width / 2, game.player.y);
        ctx.lineTo(game.player.x + game.player.width, game.player.y + game.player.height);
        ctx.lineTo(game.player.x + game.player.width * 0.75, game.player.y + game.player.height * 0.7);
        ctx.lineTo(game.player.x + game.player.width / 2, game.player.y + game.player.height * 0.6);
        ctx.lineTo(game.player.x + game.player.width * 0.25, game.player.y + game.player.height * 0.7);
        ctx.lineTo(game.player.x, game.player.y + game.player.height);
        ctx.closePath();
        ctx.fill();
        
        // Glow ring
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Health bar
        const barWidth = 60;
        const barHeight = 5;
        const barX = game.player.x - barWidth / 2 + game.player.width / 2;
        const barY = game.player.y - 20;

        ctx.fillStyle = '#ff3366';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthPercent = Math.max(0, game.player.health / 100);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        
        // Health bar border
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}

// Event Listeners
playBtn.addEventListener('click', resetGame);

// Save best score
window.addEventListener('beforeunload', () => {
    if (game.score > game.bestScore) {
        game.bestScore = game.score;
    }
    localStorage.setItem('bestScore', game.bestScore);
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.gameState === 'playing') {
        game.isPaused = true;
        pauseOverlay.classList.add('active');
    }
});

// Initialize
initJoystick();
updateLivesDisplay();
updateScoreDisplay();
spawnWave();
gameLoop();

console.log('[v0] Sky Fighter Enhanced - Game Started');
