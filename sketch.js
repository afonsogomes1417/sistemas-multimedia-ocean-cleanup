const GAME_SECONDS = 75;
const PLAYER_RADIUS = 25;
const THRESHOLD_LOW = 0.018;
const THRESHOLD_HIGH = 0.035;

let gameState = "intro";
let mic;
let micReady = false;
let micError = "";
let calibrationStartedAt = 0;
let calibrationSamples = [];
let ambientLevel = 0;
let thresholdLow = THRESHOLD_LOW;
let thresholdHigh = THRESHOLD_HIGH;
let microphoneLevel = 0;
let propulsionActive = false;
let turboStartedAt = 0;
let turboUntil = 0;
let turbo = false;
let player;
let objects = [];
let score = 0;
let lives = 3;
let gameStartedAt = 0;
let lastSpawnAt = 0;
let cleaned = 0;
let totalPlastic = 0;
let hitFlashUntil = 0;
let bubbles = [];
let feedbackOscillator;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("game");
  pixelDensity(1);
  textFont("DM Sans");
  textAlign(LEFT, CENTER);
  feedbackOscillator = new p5.Oscillator("sine");
  feedbackOscillator.amp(0);
  feedbackOscillator.start();
  player = { x: width * 0.28, y: height * 0.52, targetX: width * 0.28, targetY: height * 0.52 };
  bubbles = Array.from({ length: 34 }, () => ({
    x: random(width),
    y: random(height),
    radius: random(1, 4),
    speed: random(0.25, 1.1),
    alpha: random(18, 65)
  }));
}

function draw() {
  if (gameState === "intro") updateCalibration();
  background(224, 241, 248);
  drawOcean();

  if (gameState === "intro") {
    drawIntro();
  } else if (gameState === "playing") {
    updateGame();
    drawGame();
  } else {
    drawResults();
  }
}

function playCue(frequency, volume, duration) {
  if (!feedbackOscillator || getAudioContext().state !== "running") return;
  feedbackOscillator.freq(frequency, 0.01);
  feedbackOscillator.amp(volume, 0.01);
  feedbackOscillator.amp(0, duration);
}

function drawOcean() {
  const progress = gameState === "playing" || gameState === "results"
    ? constrain(cleaned / 16, 0, 1)
    : 0;
  background(lerpColor(color(224, 241, 248), color(198, 233, 222), progress));
  noStroke();
  fill(178, 222, 238, 80);
  ellipse(width * 0.78, height * 0.08, width * 0.8, height * 0.35);
  fill(125, 211, 195, progress * 28);
  ellipse(width * 0.52, height * 0.66, width * 0.9, height * 0.42);
  drawBubbles();
  drawReef(progress);
}

function drawBubbles() {
  noFill();
  for (const bubble of bubbles) {
    stroke(185, 239, 230, bubble.alpha);
    circle(bubble.x, bubble.y, bubble.radius * 2);
    bubble.y -= bubble.speed;
    if (bubble.y < -8) {
      bubble.y = height + 8;
      bubble.x = random(width);
    }
  }
}

function drawReef(progress) {
  noStroke();
  fill(105, 137, 162, 70);
  beginShape();
  curveVertex(0, height * 0.93);
  curveVertex(0, height * 0.93);
  curveVertex(width * 0.18, height * 0.91);
  curveVertex(width * 0.39, height * 0.94);
  curveVertex(width * 0.64, height * 0.9);
  curveVertex(width * 0.82, height * 0.93);
  curveVertex(width, height * 0.91);
  curveVertex(width, height * 0.91);
  vertex(width, height);
  vertex(0, height);
  endShape(CLOSE);

}

function drawIntro() {
  const panelWidth = min(690, width - 40);
  const panelX = (width - panelWidth) / 2;
  const panelY = max(74, height * 0.13);

  noStroke();
  fill(248, 251, 253, 242);
  rect(panelX, panelY, panelWidth, min(500, height - panelY - 68), 8);
  stroke(103, 130, 151, 190);
  strokeWeight(2);
  noFill();
  rect(panelX, panelY, panelWidth, min(500, height - panelY - 68), 8);
  strokeWeight(1);
  noStroke();

  fill(25, 84, 115);
  textAlign(CENTER, CENTER);
  textFont("Barlow Condensed");
  textSize(32);
  textStyle(BOLD);
  text("OCEAN PLASTIC CLEANUP", width / 2, panelY + 31);
  textFont("DM Sans");
  fill(85, 113, 128);
  textSize(11);
  textStyle(NORMAL);
  text("Sistemas Multimédia · P5.js", width / 2, panelY + 59);
  textAlign(LEFT, CENTER);

  const isCalibrating = gameState === "intro" && calibrationStartedAt > 0 && !micError && millis() - calibrationStartedAt < 3000;
  const calibrated = micReady && !isCalibrating;
  drawCalibration(panelX + 32, panelY + 104, panelWidth - 64, isCalibrating, calibrated);

  const infoY = panelY + 244;
  drawInstruction("01", "SOPRAR / FALAR", "A voz acelera a embarcação; voz sustentada ativa o turbo.", panelX + 32, infoY, panelWidth - 64);
  drawInstruction("02", "RATO / SETAS", "Guia a embarcação e evita a fauna marinha.", panelX + 32, infoY + 53, panelWidth - 64);
  drawInstruction("03", "RECOLHER", "Garrafa +10 · saco +15 · vida marinha: −1 vida.", panelX + 32, infoY + 92, panelWidth - 64);

  const buttonY = min(panelY + 396, height - 96);
  const buttonLabel = isCalibrating ? "A CALIBRAR MICROFONE…" : calibrated ? "INICIAR LIMPEZA" : micError ? "CONTINUAR SEM MICROFONE" : "ATIVAR MICROFONE";
  drawButton(width / 2, buttonY, min(340, panelWidth - 48), 50, buttonLabel, !isCalibrating);
  if (calibrated) {
    fill(142, 213, 173);
    textSize(11);
    textAlign(CENTER, CENTER);
    text("CALIBRAÇÃO CONCLUÍDA · LIMITE DE RUÍDO AJUSTADO", width / 2, buttonY + 36);
    textAlign(LEFT, CENTER);
  }
  drawFooter();
}

function drawCalibration(x, y, w, isCalibrating, calibrated) {
  noStroke();
  fill(237, 246, 250);
  rect(x, y, w, 116, 5);
  stroke(77, 157, 180);
  rect(x, y, w, 116, 5);
  noStroke();
  fill(34, 103, 139);
  textSize(12);
  textStyle(BOLD);
  text("CALIBRAÇÃO DO MICROFONE", x + 15, y + 19);
  textStyle(NORMAL);

  const barX = x + 15;
  const barY = y + 43;
  const barW = w - 30;
  noStroke();
  fill(218, 229, 236);
  rect(barX, barY, barW, 9, 5);
  fill(53, 184, 224);
  rect(barX, barY, barW * constrain(microphoneLevel * 7, 0, 1), 9, 5);
  stroke(255, 203, 107);
  line(barX + barW * constrain(thresholdLow * 7, 0, 0.9), barY - 4, barX + barW * constrain(thresholdLow * 7, 0, 0.9), barY + 14);
  stroke(255, 117, 94);
  line(barX + barW * constrain(thresholdHigh * 7, 0, 0.95), barY - 4, barX + barW * constrain(thresholdHigh * 7, 0, 0.95), barY + 14);
  noStroke();

  fill(95, 113, 126);
  textSize(10);
  const message = micError
    ? width < 600 ? "Microfone indisponível." : micError
    : isCalibrating
      ? width < 600
        ? `Silêncio · ${max(0, 3 - floor((millis() - calibrationStartedAt) / 1000))} s`
        : `Silêncio durante a medição · ${max(0, 3 - floor((millis() - calibrationStartedAt) / 1000))} s`
      : calibrated
        ? width < 600
          ? `Ruído ${ambientLevel.toFixed(3)} · limites ajustados`
          : `Ruído ambiente ${ambientLevel.toFixed(3)} · limites de histerese ajustados`
        : width < 600
          ? "Calibração silenciosa · 3 segundos."
          : "A calibração silenciosa demora 3 segundos após ativar o microfone.";
  text(message, x + 15, y + 78);
  if (!micReady && !micError) {
    fill(132, 173, 174);
    text(width < 600 ? "Sem microfone? Rato e teclado disponíveis." : "Sem autorização? Podes continuar com rato e teclado.", x + 15, y + 99);
  }
}

function drawInstruction(number, title, description, x, y, maxWidth) {
  fill(24, 142, 190);
  textSize(11);
  textStyle(BOLD);
  text(number, x, y);
  fill(47, 63, 75);
  text(title, x + 30, y);
  fill(88, 105, 117);
  textSize(11);
  textStyle(NORMAL);
  text(description, x + 30, y + 20, maxWidth - 30);
}

function drawBrand() {
  fill(35, 116, 150);
  textSize(11);
  textStyle(BOLD);
  text("OCEAN / 01", 30, 32);
  fill(25, 84, 115);
  textFont("Barlow Condensed");
  textSize(min(46, width * 0.1));
  textStyle(BOLD);
  text("OCEAN PLASTIC CLEANUP", 30, 76);
  textFont("DM Sans");
  textStyle(NORMAL);
  fill(85, 113, 128);
  textSize(12);
  text("Sistemas Multimédia · P5.js", 32, 108);
}

function drawFooter() {
  const compact = width < 600;
  const footerHeight = compact ? 46 : 34;
  if (gameState === "playing") {
    noStroke();
    fill(31, 48, 69);
    rect(0, height - footerHeight, width, footerHeight);
    fill(241, 247, 249);
  } else {
    fill(73, 102, 124);
  }
  textSize(compact ? 9 : 10);
  if (compact) {
    textAlign(CENTER, CENTER);
    text("OCEAN PLASTIC CLEANUP", width / 2, height - 29);
    text("AFONSO DINIS ALMEIDA GOMES · Nº 33108 · ECGM", width / 2, height - 13);
  } else {
    textAlign(LEFT, CENTER);
    text("OCEAN PLASTIC CLEANUP", 24, height - 22);
    textAlign(RIGHT, CENTER);
    text("AFONSO DINIS ALMEIDA GOMES · Nº 33108 · ECGM", width - 24, height - 22);
  }
  textAlign(LEFT, CENTER);
}

function drawButton(x, y, w, h, label, enabled) {
  const hovered = abs(mouseX - x) < w / 2 && abs(mouseY - y) < h / 2;
  noStroke();
  fill(enabled ? (hovered ? color(20, 145, 193) : color(8, 132, 188)) : color(117, 151, 163));
  rectMode(CENTER);
  rect(x, y, w, h, 4);
  fill(248, 252, 253);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(13);
  text(label, x, y);
  textStyle(NORMAL);
  textAlign(LEFT, CENTER);
  rectMode(CORNER);
}

function startMicrophone() {
  userStartAudio();
  if (micReady) {
    beginGame();
    return;
  }
  if (micError || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    beginGame();
    return;
  }
  mic = new p5.AudioIn();
  mic.start(() => {
    micReady = true;
    micError = "";
    calibrationSamples = [];
    calibrationStartedAt = millis();
  }, () => {
    micError = "Microfone indisponível. O controlo manual continua ativo.";
  });
}

function updateCalibration() {
  if (!micReady || calibrationStartedAt === 0) return;
  microphoneLevel = mic.getLevel();
  if (millis() - calibrationStartedAt < 3000) {
    calibrationSamples.push(microphoneLevel);
    return;
  }
  ambientLevel = calibrationSamples.length
    ? calibrationSamples.reduce((sum, sample) => sum + sample, 0) / calibrationSamples.length
    : 0;
  thresholdLow = max(0.012, ambientLevel + 0.012);
  thresholdHigh = max(0.028, ambientLevel + 0.035);
  calibrationStartedAt = 0;
}

function beginGame() {
  gameState = "playing";
  score = 0;
  lives = 3;
  cleaned = 0;
  totalPlastic = 0;
  objects = [];
  turbo = false;
  propulsionActive = false;
  gameStartedAt = millis();
  lastSpawnAt = millis() - 1200;
  player.x = width * 0.25;
  player.y = height * 0.52;
  player.targetX = player.x;
  player.targetY = player.y;
}

function updateGame() {
  if (micReady) {
    microphoneLevel = mic.getLevel();
    if (!propulsionActive && microphoneLevel >= thresholdHigh) propulsionActive = true;
    if (propulsionActive && microphoneLevel <= thresholdLow) propulsionActive = false;
    if (propulsionActive) {
      if (!turboStartedAt) turboStartedAt = millis();
      if (millis() - turboStartedAt > 950) {
        const activated = !turbo;
        turbo = true;
        turboUntil = millis() + 750;
        if (activated) playCue(880, 0.045, 0.16);
      }
    } else {
      turboStartedAt = 0;
    }
  }
  if (millis() > turboUntil) turbo = false;

  const keyboardSpeed = keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW) || keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW);
  if (keyboardSpeed) {
    if (keyIsDown(LEFT_ARROW)) player.targetX -= 5;
    if (keyIsDown(RIGHT_ARROW)) player.targetX += 5;
    if (keyIsDown(UP_ARROW)) player.targetY -= 5;
    if (keyIsDown(DOWN_ARROW)) player.targetY += 5;
  } else {
    player.targetX = mouseX;
    player.targetY = mouseY;
  }
  player.targetX = constrain(player.targetX, PLAYER_RADIUS + 8, width - PLAYER_RADIUS - 8);
  player.targetY = constrain(player.targetY, 105, height - 70);
  const easing = 0.12;
  player.x = lerp(player.x, player.targetX, easing);
  player.y = lerp(player.y, player.targetY, easing);

  if (millis() - lastSpawnAt > random(760, 1250)) {
    spawnObject();
    lastSpawnAt = millis();
  }
  for (let i = objects.length - 1; i >= 0; i--) {
    const object = objects[i];
    object.x -= object.speed * (turbo ? 1.85 : propulsionActive ? 1.35 : 1);
    object.y += sin(frameCount * 0.035 + object.phase) * 0.45;
    if (circlesOverlap(player.x, player.y, PLAYER_RADIUS, object.x, object.y, object.radius)) {
      if (object.kind === "bottle" || object.kind === "bag") {
        score += object.points;
        cleaned++;
        playCue(object.kind === "bottle" ? 720 : 560, 0.055, 0.1);
      } else {
        lives--;
        hitFlashUntil = millis() + 450;
        playCue(170, 0.07, 0.18);
      }
      objects.splice(i, 1);
      if (lives <= 0) finishGame();
    } else if (object.x < -45) {
      objects.splice(i, 1);
    }
  }

  if (millis() - gameStartedAt >= GAME_SECONDS * 1000) finishGame();
}

function spawnObject() {
  const plastic = random() < 0.68;
  const kind = plastic ? (random() < 0.54 ? "bottle" : "bag") : random() < 0.58 ? "fish" : "turtle";
  const radius = kind === "bottle" ? 13 : kind === "bag" ? 17 : kind === "fish" ? 19 : 23;
  objects.push({
    kind,
    x: width + radius + 8,
    y: random(125, height - 94),
    radius,
    speed: random(1.1, 2.35),
    phase: random(TWO_PI),
    points: kind === "bottle" ? 10 : 15
  });
  if (plastic) totalPlastic++;
}

function circlesOverlap(x1, y1, r1, x2, y2, r2) {
  return dist(x1, y1, x2, y2) < r1 + r2;
}

function drawGame() {
  drawHud();
  for (const object of objects) drawObject(object);
  drawPlayer();
  drawVoiceMeter();
  drawFooter();
  if (millis() < hitFlashUntil) {
    noFill();
    stroke(255, 95, 81, 125);
    strokeWeight(8);
    rect(4, 4, width - 8, height - 8, 12);
    strokeWeight(1);
  }
}

function drawHud() {
  noStroke();
  fill(214, 235, 248);
  rect(0, 0, width, 75);
  fill(43, 112, 148);
  textSize(9);
  textStyle(BOLD);
  text("PONTUAÇÃO", 25, 20);
  text("VIDAS", width * 0.47, 20);
  text("TEMPO", width - 115, 20);
  fill(36, 66, 83);
  textFont("Barlow Condensed");
  textSize(25);
  text(score.toString().padStart(4, "0"), 25, 48);
  fill(204, 74, 79);
  textFont("DM Sans");
  textSize(18);
  text("♥ ".repeat(max(0, lives)).trim() || "—", width * 0.47, 49);
  textFont("Barlow Condensed");
  textSize(25);
  text(formatTime(), width - 115, 48);
  textFont("DM Sans");
  textSize(10);
  textStyle(NORMAL);
}

function formatTime() {
  const remaining = max(0, GAME_SECONDS - floor((millis() - gameStartedAt) / 1000));
  return `${floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
}

function drawPlayer() {
  push();
  translate(player.x, player.y);
  noStroke();
  fill(89, 224, 206, 45);
  ellipse(-9, 0, 79 + (turbo ? 24 : 0), 59 + (turbo ? 13 : 0));
  fill(3, 160, 175);
  ellipse(0, 0, 57, 34);
  fill(11, 65, 78);
  ellipse(13, 0, 17, 19);
  fill(200, 246, 226);
  circle(16, -3, 5);
  fill(237, 165, 92);
  triangle(-27, -8, -38, 0, -27, 8);
  fill(215, 244, 230, 170);
  rect(-11, -13, 15, 7, 3);
  if (turbo) {
    fill(255, 186, 112, 175);
    triangle(-30, -5, -48 - random(7), 0, -30, 5);
  }
  pop();
}

function drawObject(object) {
  push();
  translate(object.x, object.y);
  noStroke();
  if (object.kind === "bottle") {
    fill(92, 209, 199);
    rect(-5, -12, 10, 24, 3);
    rect(-3, -16, 6, 6, 2);
    fill(191, 247, 222, 150);
    rect(-2, -7, 3, 9, 1);
  } else if (object.kind === "bag") {
    fill(239, 162, 79);
    beginShape();
    vertex(-13, -10); vertex(-6, -15); vertex(-2, -9); vertex(7, -14);
    vertex(14, -6); vertex(10, 11); vertex(-11, 13); vertex(-15, 1);
    endShape(CLOSE);
    fill(255, 217, 162);
    circle(-4, 1, 3);
  } else if (object.kind === "fish") {
    fill(113, 193, 147);
    ellipse(0, 0, 31, 19);
    triangle(-13, 0, -24, -9, -23, 9);
    fill(241, 248, 225);
    circle(8, -3, 4);
    fill(18, 54, 59);
    circle(9, -3, 2);
  } else {
    fill(87, 172, 127);
    ellipse(0, 0, 31, 23);
    fill(113, 193, 147);
    ellipse(15, -1, 13, 12);
    ellipse(-10, 12, 8, 11);
    ellipse(8, 12, 8, 11);
    fill(22, 59, 57);
    circle(18, -3, 2);
  }
  pop();
}

function drawVoiceMeter() {
  const x = 24;
  const y = 95;
  const w = 160;
  fill(40, 100, 128);
  textSize(9);
  textStyle(BOLD);
  text("PROPULSÃO / VOZ", x, y);
  noStroke();
  fill(196, 220, 231);
  rect(x, y + 14, w, 8, 4);
  fill(turbo ? color(255, 177, 100) : color(83, 207, 189));
  rect(x, y + 14, w * constrain(microphoneLevel * 7, 0, 1), 8, 4);
  stroke(255, 190, 104);
  line(x + w * constrain(thresholdLow * 7, 0, 1), y + 11, x + w * constrain(thresholdLow * 7, 0, 1), y + 25);
  stroke(255, 112, 92);
  line(x + w * constrain(thresholdHigh * 7, 0, 1), y + 11, x + w * constrain(thresholdHigh * 7, 0, 1), y + 25);
  noStroke();
  fill(59, 89, 104);
  textStyle(NORMAL);
  textSize(9);
  text(turbo ? "TURBO ATIVO" : propulsionActive ? "PROPULSÃO ATIVA" : "PRONTO", x, y + 39);
}

function finishGame() {
  if (gameState !== "playing") return;
  gameState = "results";
  propulsionActive = false;
  turbo = false;
}

function drawResults() {
  const panelWidth = min(570, width - 40);
  const panelX = (width - panelWidth) / 2;
  const panelY = max(74, height * 0.13);
  noStroke();
  fill(248, 251, 253, 242);
  rect(panelX, panelY, panelWidth, min(410, height - panelY - 65), 8);
  stroke(103, 130, 151, 190);
  noFill();
  rect(panelX, panelY, panelWidth, min(410, height - panelY - 65), 8);
  noStroke();
  fill(29, 105, 145);
  textAlign(CENTER, CENTER);
  textFont("Barlow Condensed");
  textSize(32);
  textStyle(BOLD);
  text("OCEAN PLASTIC CLEANUP", width / 2, panelY + 31);
  textFont("DM Sans");
  fill(85, 113, 128);
  textSize(10);
  textStyle(NORMAL);
  text("Sistemas Multimédia · P5.js", width / 2, panelY + 57);
  fill(29, 105, 145);
  textStyle(BOLD);
  textSize(11);
  text("RELATÓRIO DE MISSÃO", width / 2, panelY + 82);
  fill(25, 84, 115);
  textFont("Barlow Condensed");
  textSize(56);
  text(score.toString().padStart(4, "0"), width / 2, panelY + 143);
  textFont("DM Sans");
  textSize(12);
  textStyle(NORMAL);
  fill(85, 113, 128);
  text("PONTOS RECUPERADOS", width / 2, panelY + 180);

  const rate = totalPlastic ? constrain(cleaned / totalPlastic, 0, 1) : 0;
  fill(47, 63, 75);
  textSize(14);
  text(`${cleaned} resíduos recolhidos  ·  ${lives} vidas restantes`, width / 2, panelY + 216);
  fill(85, 113, 128);
  textSize(11);
  text(`Água recuperada: ${round(rate * 100)}%`, width / 2, panelY + 246);
  noStroke();
  fill(218, 229, 236);
  rect(panelX + 56, panelY + 267, panelWidth - 112, 8, 4);
  fill(53, 184, 154);
  rect(panelX + 56, panelY + 267, (panelWidth - 112) * rate, 8, 4);

  drawButton(width / 2, panelY + 329, min(300, panelWidth - 48), 48, "REPETIR MISSÃO", true);
  drawFooter();
  textAlign(LEFT, CENTER);
}

function mousePressed() {
  if (gameState === "intro") {
    const buttonY = min(max(74, height * 0.13) + 396, height - 96);
    if (abs(mouseX - width / 2) < min(340, min(690, width - 40) - 48) / 2 && abs(mouseY - buttonY) < 30) {
      if (micReady && calibrationStartedAt === 0) beginGame();
      else if (!micReady) startMicrophone();
    }
  } else if (gameState === "results") {
    const panelY = max(74, height * 0.13);
    if (abs(mouseX - width / 2) < 170 && abs(mouseY - (panelY + 329)) < 30) beginGame();
  }
}

function keyPressed() {
  if (gameState === "intro" && (keyCode === ENTER || key === " ")) {
    if (micReady && calibrationStartedAt === 0) beginGame();
    else if (!micReady) startMicrophone();
  } else if (gameState === "results" && (keyCode === ENTER || key === " ")) {
    beginGame();
  }
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (player) {
    player.x = constrain(player.x, PLAYER_RADIUS + 8, width - PLAYER_RADIUS - 8);
    player.y = constrain(player.y, 105, height - 70);
  }
}

const originalDraw = draw;
draw = function () {
  if (gameState === "intro") updateCalibration();
  originalDraw();
};