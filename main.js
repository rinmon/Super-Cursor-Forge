// Super Cursor Forge: Minimal Prototype
// --- Constants ---
const GRID_SIZE = 3;
const CELL_SIZE = 120;
const GRID_ORIGIN = { x: 120, y: 120 };
const ORB_RADIUS = 18;
const ENERGY_MAX = 100;
const ENERGY_DECREASE = 0.08;
const BUILD_ZONE = { x: 120, y: 120, w: 120, h: 120, color: '#4fc3f7' }; // 明るい青
const BREAK_ZONE = { x: 360, y: 120, w: 120, h: 120, color: '#ff8a65' }; // 明るいオレンジ
const GRAVITY_FIELD = { x: 240, y: 360, w: 120, h: 120, color: '#fff59d77' }; // 明るい黄
const STAGE_BLUEPRINT = [
  [1,0,1],
  [0,1,0],
  [1,0,1]
]; // 1:必要クリスタル
const PORTAL_POS = { x: 2, y: 2 };

// --- State ---
let orb = { x: GRID_ORIGIN.x, y: GRID_ORIGIN.y, energy: ENERGY_MAX };
let mouse = { x: orb.x, y: orb.y };
let mode = 'build'; // 'build' or 'break'
let grid = [
  [0,0,0],
  [0,0,0],
  [0,0,0]
];
let running = true;
let cleared = false;
let moveHistory = [];
let penalty = 0;

// --- Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  document.body.style.height = window.innerHeight + 'px';
  document.documentElement.style.height = window.innerHeight + 'px';
  let size = Math.min(window.innerWidth, window.innerHeight * 0.95, 600);
  canvas.width = size;
  canvas.height = size;
  window.scrollTo(0,0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
const gauge = document.getElementById('energyGauge');
const gaugeCtx = gauge.getContext('2d');
const seCreate = document.getElementById('se-create');
const seBreak = document.getElementById('se-break');
const bgm = document.getElementById('bgm');
const showGraphBtn = document.getElementById('showGraph');
const graphContainer = document.getElementById('graphContainer');
const moveGraph = document.getElementById('moveGraph');

// --- Utility ---
function inZone(mx, my, zone) {
  return mx >= zone.x && mx < zone.x + zone.w && my >= zone.y && my < zone.y + zone.h;
}
function cellAt(mx, my) {
  for(let i=0;i<GRID_SIZE;i++){
    for(let j=0;j<GRID_SIZE;j++){
      let cx = GRID_ORIGIN.x + j*CELL_SIZE;
      let cy = GRID_ORIGIN.y + i*CELL_SIZE;
      if(mx >= cx && mx < cx+CELL_SIZE && my >= cy && my < cy+CELL_SIZE) return {i,j};
    }
  }
  return null;
}
function drawEnergyGauge(val) {
  let percent = val/ENERGY_MAX;
  gaugeCtx.clearRect(0,0,80,80);
  gaugeCtx.beginPath();
  gaugeCtx.arc(40,40,36,0,2*Math.PI);
  gaugeCtx.strokeStyle = '#444';
  gaugeCtx.lineWidth = 6;
  gaugeCtx.stroke();
  gaugeCtx.beginPath();
  gaugeCtx.arc(40,40,36,-Math.PI/2,(-Math.PI/2)+2*Math.PI*percent);
  gaugeCtx.strokeStyle = percent > 0.3 ? '#00e5ff' : '#e53935';
  gaugeCtx.lineWidth = 8;
  gaugeCtx.stroke();
}
function drawPortal() {
  let px = GRID_ORIGIN.x + PORTAL_POS.y*CELL_SIZE + CELL_SIZE/2;
  let py = GRID_ORIGIN.y + PORTAL_POS.x*CELL_SIZE + CELL_SIZE/2;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(px, py, 32, 0, 2*Math.PI);
  ctx.strokeStyle = cleared ? '#fff176' : '#00e5ff';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();
}
function playSE(audio) {
  audio.currentTime = 0;
  audio.play();
}

// --- セルボタンとオーブ移動 ---
// セルの中心点座標を計算
function getCellCenter(i, j) {
  return {
    x: GRID_ORIGIN.x + j * CELL_SIZE + CELL_SIZE / 2,
    y: GRID_ORIGIN.y + i * CELL_SIZE + CELL_SIZE / 2
  };
}
// クリック/タッチ位置がセルの中か厳密にチェック
function isPointInCell(x, y) {
  // グリッド全体からの相対位置を計算
  const relX = x - GRID_ORIGIN.x;
  const relY = y - GRID_ORIGIN.y;
  
  // グリッド外ならnull
  if (relX < 0 || relY < 0 || 
      relX >= GRID_SIZE * CELL_SIZE || 
      relY >= GRID_SIZE * CELL_SIZE) {
    return null;
  }
  
  // セルの行列を計算
  const i = Math.floor(relY / CELL_SIZE);
  const j = Math.floor(relX / CELL_SIZE);
  
  // 有効範囲内ならそのセルを返す
  if (i >= 0 && i < GRID_SIZE && j >= 0 && j < GRID_SIZE) {
    return { i, j };
  }
  return null;
}

function moveOrbToCell(i, j) {
  const cellCenterX = GRID_ORIGIN.x + j * CELL_SIZE + CELL_SIZE / 2;
  const cellCenterY = GRID_ORIGIN.y + i * CELL_SIZE + CELL_SIZE / 2;
  orb.target = { x: cellCenterX, y: cellCenterY };
}

// タッチ/クリックイベント処理
function handleInteraction(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);
  
  const cell = getCellFromPoint(x, y);
  if (cell) {
    moveOrbToCell(cell.i, cell.j);
    return true; // 有効なセルをクリックした
  }
  return false; // 有効なセル以外をクリックした
}

// PC用クリックイベント
canvas.addEventListener('click', function(e) {
  handleInteraction(e.clientX, e.clientY);
});

// iOS Safari用タッチイベント
canvas.addEventListener('touchstart', function(e) {
  if (e.touches && e.touches.length > 0) {
    if (handleInteraction(e.touches[0].clientX, e.touches[0].clientY)) {
      e.preventDefault(); // 有効なセルタップのみ中止
    }
  }
}, {passive: false});

// さらにイベントを追加し、iOS Safariのための対策
canvas.addEventListener('touchend', function(e) {
  e.preventDefault();
}, {passive: false});
document.addEventListener('gesturestart', function(e) {
  e.preventDefault(); // iOSピンチズーム防止
});
// --- 旧マウス・タッチ追従イベントは無効化 ---
window.addEventListener('mouseleave', () => {
  // 何もしない
});

// --- Main Loop ---
function gameLoop() {
  if(!running) return;
  // --- モード切り替え ---
  if(inZone(orb.x, orb.y, BUILD_ZONE)) mode = 'build';
  else if(inZone(orb.x, orb.y, BREAK_ZONE)) mode = 'break';
  // --- オーブの移動処理 ---
  let targetX = orb.x;
  let targetY = orb.y;
  
  // 目標地点が設定されている場合はそこに向かう
  if (orb.target) {
    targetX = orb.target.x;
    targetY = orb.target.y;
  }
  
  // 移動計算
  let dx = targetX - orb.x;
  let dy = targetY - orb.y;
  let dist = Math.hypot(dx, dy);
  let speed = Math.min(6, dist * 0.2); // 距離によって速度変化
  
  // 重力フィールドの影響
  if(inZone(orb.x, orb.y, GRAVITY_FIELD)) {
    let center = { x: GRAVITY_FIELD.x+GRAVITY_FIELD.w/2, y: GRAVITY_FIELD.y+GRAVITY_FIELD.h/2 };
    dx += (center.x - orb.x)*0.04;
    dy += (center.y - orb.y)*0.04;
    speed *= 0.7;
    dist = Math.hypot(dx, dy); // 重力により方向が変わったので再計算
  }
  
  // 一定距離以上で移動
  if (dist > 1) {
    orb.x += dx/dist*speed;
    orb.y += dy/dist*speed;
    orb.energy = Math.max(0, orb.energy - ENERGY_DECREASE*speed);
  } else if (orb.target) {
    // 目標に着いたらクリア
    orb.x = orb.target.x;
    orb.y = orb.target.y;
  }
  // --- 軌跡記録 ---
  if(running) moveHistory.push({x: orb.x, y: orb.y, t: Date.now()});
  // --- クリスタル配置/破壊 ---
  if(dist<ORB_RADIUS+2) {
    let cell = cellAt(orb.x, orb.y);
    if(cell) {
      if(mode==='build' && STAGE_BLUEPRINT[cell.i][cell.j]===1 && grid[cell.i][cell.j]===0) {
        grid[cell.i][cell.j]=1;
        playSE(seCreate);
      }
      if(mode==='break' && grid[cell.i][cell.j]===1) {
        if(STAGE_BLUEPRINT[cell.i][cell.j]===0) {
          grid[cell.i][cell.j]=0;
          playSE(seBreak);
        } else {
          penalty++;
        }
      }
    }
  }
  // --- ポータル到達判定 ---
  let allSet = true;
  for(let i=0;i<GRID_SIZE;i++)for(let j=0;j<GRID_SIZE;j++){
    if(STAGE_BLUEPRINT[i][j]!==grid[i][j]) allSet=false;
  }
  let portalCenter = {
    x: GRID_ORIGIN.x + PORTAL_POS.y*CELL_SIZE + CELL_SIZE/2,
    y: GRID_ORIGIN.y + PORTAL_POS.x*CELL_SIZE + CELL_SIZE/2
  };
  if(allSet && Math.hypot(orb.x-portalCenter.x, orb.y-portalCenter.y)<36 && !cleared) {
    cleared = true;
    running = false;
    setTimeout(showGraph, 1200);
  }
  if(orb.energy<=0 && !cleared) {
    running = false;
    setTimeout(()=>{alert('エネルギー切れ！リスタート');location.reload();}, 800);
  }
  // --- 描画 ---
  draw();
  drawEnergyGauge(orb.energy);
  if(running) requestAnimationFrame(gameLoop);
}

// --- 描画 ---
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // ゾーン
  [BUILD_ZONE,BREAK_ZONE,GRAVITY_FIELD].forEach(zone=>{
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = zone.color;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.restore();
  });
  // グリッドとボタン風セル
  for(let i=0;i<GRID_SIZE;i++){
    for(let j=0;j<GRID_SIZE;j++){
      const cellX = GRID_ORIGIN.x + j*CELL_SIZE;
      const cellY = GRID_ORIGIN.y + i*CELL_SIZE;
      const centerX = cellX + CELL_SIZE/2;
      const centerY = cellY + CELL_SIZE/2;
      
      // ボタン風のセル背景
      ctx.save();
      // ボタンの影と外枚
      ctx.fillStyle = '#ffffff33';
      ctx.shadowColor = '#00000044';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      // 角丸四角形
      ctx.beginPath();
      const radius = 8;
      ctx.moveTo(cellX + radius, cellY);
      ctx.lineTo(cellX + CELL_SIZE - radius, cellY);
      ctx.arc(cellX + CELL_SIZE - radius, cellY + radius, radius, -Math.PI/2, 0);
      ctx.lineTo(cellX + CELL_SIZE, cellY + CELL_SIZE - radius);
      ctx.arc(cellX + CELL_SIZE - radius, cellY + CELL_SIZE - radius, radius, 0, Math.PI/2);
      ctx.lineTo(cellX + radius, cellY + CELL_SIZE);
      ctx.arc(cellX + radius, cellY + CELL_SIZE - radius, radius, Math.PI/2, Math.PI);
      ctx.lineTo(cellX, cellY + radius);
      ctx.arc(cellX + radius, cellY + radius, radius, Math.PI, Math.PI*3/2);
      ctx.closePath();
      
      ctx.fill();
      ctx.restore();
      
      // セルの枠線
      ctx.strokeStyle = '#ffffff77';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
      
      // 設計図ガイド
      if(STAGE_BLUEPRINT[i][j]===1) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#29b6f6'; // 明るいガイド
        ctx.beginPath();
        ctx.arc(centerX, centerY, 32, 0, 2*Math.PI);
        ctx.fill();
        ctx.restore();
      }
      
      // クリスタル
      if(grid[i][j]===1) {
        ctx.save();
        ctx.shadowColor = '#4fc3f7';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#fffde7';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 28, 0, 2*Math.PI);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // ポータル
  drawPortal();
  // オーブ
  ctx.save();
  ctx.shadowColor = mode==='build' ? '#00e5ff' : '#e53935';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, ORB_RADIUS, 0, 2*Math.PI);
  ctx.fillStyle = mode==='build' ? '#00e5ff' : '#e53935';
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.restore();
  // エネルギー残量
  ctx.save();
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#222b';
  ctx.fillText('Energy: '+Math.round(orb.energy), 20, 590);
  ctx.restore();

  // デバッグ: オーブ座標とモード
  ctx.save();
  ctx.font = '13px monospace';
  ctx.fillStyle = '#222b';
  ctx.fillText(`orb: (${Math.round(orb.x)}, ${Math.round(orb.y)}) mode: ${mode}`, 20, 570);
  ctx.restore();
  // ペナルティ
  if(penalty>0) {
    ctx.save();
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#e53935';
    ctx.fillText('ペナルティ: '+penalty, 440, 590);
    ctx.restore();
  }
  // クリア演出
  if(cleared) {
    ctx.save();
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#fff176';
    ctx.shadowColor = '#fff176';
    ctx.shadowBlur = 24;
    ctx.globalAlpha = 0.9;
    ctx.fillText('STAGE CLEAR!', 170, 320);
    ctx.restore();
  }
}

// --- 軌跡グラフ ---
function showGraph() {
  showGraphBtn.style.display = 'block';
  showGraphBtn.onclick = () => {
    graphContainer.style.display = 'block';
    // X: 経過時間, Y: Y座標
    let t0 = moveHistory[0].t;
    let data = moveHistory.map(pt=>({x:(pt.t-t0)/1000, y:pt.y}));
    new Chart(moveGraph.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [{
          label: 'あなたの移動経路',
          data,
          borderColor: '#e53935',
          pointRadius: 0,
          fill: false,
          tension: 0.1
        }]
      },
      options: {
        scales: {
          x: { type: 'linear', title: { display: true, text: '経過秒' } },
          y: { title: { display: true, text: 'Y座標' }, min:0, max:600 }
        }
      }
    });
    showGraphBtn.disabled = true;
  };
}

// --- ルール説明モーダル制御 ---
document.getElementById('showRules').onclick = () => {
  document.getElementById('rulesModal').style.display = 'flex';
};
document.getElementById('closeRules').onclick = () => {
  document.getElementById('rulesModal').style.display = 'none';
};

// --- BGM ---
bgm.volume = 0.22;
bgm.play();

// --- Start ---
draw();
drawEnergyGauge(orb.energy);
requestAnimationFrame(gameLoop);
