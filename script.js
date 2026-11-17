/**
 * Bộ điều khiển Landing Page full-screen:
 * 1. Hoạt ảnh nhân vật 3D theo con trỏ chuột (Hub-and-Spoke).
 * 2. Đốm sáng xanh sage thay thế con trỏ chuột mặc định.
 * 3. Tự động căn tỷ lệ chiều dài 3 dòng tiêu đề góc trên bên trái.
 */

const CLIPS = {
  idle: { folder: 'frames/idle', count: 74, loopStart: 0, loopEnd: 73, loopFps: 14 },
  left: { folder: 'frames/left', count: 74, loopStart: 37, loopEnd: 73, loopFps: 12 },
  right: { folder: 'frames/right', count: 74, loopStart: 37, loopEnd: 73, loopFps: 12 },
  center: { folder: 'frames/center', count: 74, loopStart: 57, loopEnd: 73, loopFps: 16 },
};

const canvas = document.getElementById('characterCanvas');
const ctx = canvas.getContext('2d');
const heroSection = document.getElementById('hero');
const loaderBadge = document.getElementById('loaderBadge');
const loaderText = document.getElementById('loaderText');
const cursorGlow = document.getElementById('cursorGlow');

const brandFirst = document.getElementById('brandFirst');
const brandFull = document.getElementById('brandFull');
const brandRole = document.getElementById('brandRole');

const bubbles = {
  left: document.getElementById('bubbleLeft'),
  right: document.getElementById('bubbleRight'),
  center: document.getElementById('bubbleCenter'),
};

const touchButtons = document.querySelectorAll('.touch-btn');
const ctaElements = document.querySelectorAll('a, button');

const framesStore = {
  idle: [],
  left: [],
  right: [],
  center: [],
};

let activeClip = 'idle';
let targetZone = 'idle';
let currentFrame = 0;
let loopDirection = 1; // 1 = tiến, -1 = lùi (ping-pong trong đoạn lặp)
let hasReachedLoop = false; // Đánh dấu đã chạy hết phần dẫn nhập vào tới đoạn lặp cuối chưa
let lastTime = performance.now();

// Tọa độ đốm sáng chuột (nội suy nhẹ cho cảm giác lướt mượt)
let mouseX = -200;
let mouseY = -200;
let glowX = -200;
let glowY = -200;
let isMouseInside = false;

function pad3(num) {
  return String(num).padStart(3, '0');
}

/**
 * Điều chỉnh cỡ chữ để:
 * - "Nhật" có chiều dài bằng đúng 2/3 dòng "Nguyễn Ngô Hoàng"
 * - "MULTIMEDIA DESIGNER & CREATIVE TEAM LEADER" có chiều dài bằng đúng dòng "Nguyễn Ngô Hoàng"
 */
function fitBrandTypography() {
  if (!brandFirst || !brandFull || !brandRole) return;

  // Đặt cỡ chữ cơ sở để đo chính xác
  brandFirst.style.fontSize = '100px';
  brandRole.style.fontSize = '20px';

  const fullWidth = brandFull.getBoundingClientRect().width;
  if (fullWidth <= 0) return;

  const firstBaseWidth = brandFirst.getBoundingClientRect().width;
  if (firstBaseWidth > 0) {
    const targetFirstWidth = fullWidth * (2 / 3);
    const computedFirstSize = 100 * (targetFirstWidth / firstBaseWidth);
    brandFirst.style.fontSize = `${computedFirstSize.toFixed(2)}px`;
  }

  const roleBaseWidth = brandRole.getBoundingClientRect().width;
  if (roleBaseWidth > 0) {
    const computedRoleSize = 20 * (fullWidth / roleBaseWidth);
    brandRole.style.fontSize = `${computedRoleSize.toFixed(2)}px`;
  }
}

/**
 * Cập nhật kích thước canvas phủ toàn màn hình (full-page)
 */
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  drawCurrentFrame();
  fitBrandTypography();
}

/**
 * Vẽ khung hình hiện tại phủ full trang theo chế độ "cover" (luôn tràn màn hình, giữ đúng tỷ lệ)
 */
function drawCurrentFrame() {
  const list = framesStore[activeClip];
  if (!list || list.length === 0) return;

  const idx = Math.max(0, Math.min(list.length - 1, Math.round(currentFrame)));
  const img = list[idx];
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = cw / ch;

  let drawW = cw;
  let drawH = ch;
  let offsetX = 0;
  let offsetY = 0;

  // Chế độ cover: phủ kín toàn bộ màn hình
  if (canvasRatio > imgRatio) {
    drawW = cw;
    drawH = cw / imgRatio;
    offsetY = (ch - drawH) * 0.52;
  } else {
    drawH = ch;
    drawW = ch * imgRatio;
    offsetX = (cw - drawW) / 2;
  }

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

/**
 * Nạp trước toàn bộ ảnh WebP của 4 clip
 */
function preloadAllFrames() {
  const totalFrames = Object.values(CLIPS).reduce((sum, c) => sum + c.count, 0);
  let loadedCount = 0;

  Object.entries(CLIPS).forEach(([name, info]) => {
    for (let i = 1; i <= info.count; i++) {
      const img = new Image();
      img.src = `${info.folder}/${pad3(i)}.webp`;

      img.onload = () => {
        loadedCount++;
        const percent = Math.round((loadedCount / totalFrames) * 100);
        loaderText.textContent = `Đang chuẩn bị hoạt ảnh... ${percent}%`;

        if (name === 'idle' && i === 1) {
          drawCurrentFrame();
        }

        if (loadedCount >= totalFrames) {
          loaderBadge.classList.add('is-done');
        }
      };

      img.onerror = () => {
        loadedCount++;
        if (loadedCount >= totalFrames) {
          loaderBadge.classList.add('is-done');
        }
      };

      framesStore[name].push(img);
    }
  });
}

function updateTouchButtons(zone) {
  Object.entries(bubbles).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle('is-visible', key === zone);
  });

  touchButtons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.zone === zone);
  });
}

function setTargetZone(newZone) {
  if (targetZone === newZone) return;
  targetZone = newZone;
  updateTouchButtons(newZone);
}

/**
 * Vòng lặp 60fps cho hoạt ảnh nhân vật và đốm sáng chuột
 */
function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // Cập nhật vị trí đốm sáng mượt mà
  if (isMouseInside && cursorGlow) {
    glowX += (mouseX - glowX) * 0.28;
    glowY += (mouseY - glowY) * 0.28;
    cursorGlow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0) translate(-50%, -50%)`;
  }

  const playFps = 22;
  const rewindFps = 55;
  const clipCfg = CLIPS[activeClip];

  if (activeClip === targetZone) {
    if (!hasReachedLoop) {
      // Giai đoạn 1: Chạy xuôi từ điểm gốc (0) tới cuối đoạn hành động (loopEnd)
      currentFrame += playFps * dt;
      if (currentFrame >= clipCfg.loopEnd) {
        currentFrame = clipCfg.loopEnd;
        hasReachedLoop = true;
        loopDirection = -1; // Bắt đầu lùi nhẹ tạo nhịp ping-pong mượt mà
      }
    } else {
      // Giai đoạn 2: Khi treo chuột lâu, lặp ping-pong liên tục trong đoạn [loopStart .. loopEnd]
      currentFrame += loopDirection * clipCfg.loopFps * dt;
      if (currentFrame >= clipCfg.loopEnd) {
        currentFrame = clipCfg.loopEnd;
        loopDirection = -1;
      } else if (currentFrame <= clipCfg.loopStart) {
        currentFrame = clipCfg.loopStart;
        loopDirection = 1;
      }
    }
  } else {
    // Giai đoạn 3: Chuột đổi hướng -> thoát khỏi vòng lặp và tua ngược nhanh về điểm gốc (0)
    hasReachedLoop = false;
    if (activeClip !== 'idle' && currentFrame > 0) {
      currentFrame = Math.max(0, currentFrame - rewindFps * dt);
      if (currentFrame === 0) {
        activeClip = targetZone;
        loopDirection = 1;
      }
    } else {
      activeClip = targetZone;
      currentFrame = 0;
      loopDirection = 1;
    }
  }

  drawCurrentFrame();
  requestAnimationFrame(animate);
}

// Theo dõi chuột trên toàn trang
window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  if (!isMouseInside) {
    isMouseInside = true;
    glowX = mouseX;
    glowY = mouseY;
    cursorGlow?.classList.add('is-active');
  }

  const relX = e.clientX / window.innerWidth;
  if (relX < 0.35) {
    setTargetZone('left');
  } else if (relX > 0.65) {
    setTargetZone('right');
  } else {
    setTargetZone('center');
  }
});

document.addEventListener('mouseleave', () => {
  isMouseInside = false;
  cursorGlow?.classList.remove('is-active');
  setTargetZone('idle');
});

// Phóng nhẹ vòng sáng khi di chuột vào nút bấm
ctaElements.forEach((el) => {
  el.addEventListener('mouseenter', () => cursorGlow?.classList.add('is-hover-cta'));
  el.addEventListener('mouseleave', () => cursorGlow?.classList.remove('is-hover-cta'));
});

// Nút điều khiển trên thiết bị cảm ứng
touchButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const zone = btn.dataset.zone;
    setTargetZone(targetZone === zone ? 'idle' : zone);
  });
});

window.addEventListener('resize', resizeCanvas);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitBrandTypography);
}

// Khởi chạy
resizeCanvas();
preloadAllFrames();
requestAnimationFrame(animate);
