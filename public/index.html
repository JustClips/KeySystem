<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Eps1llon Hub</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:700,400&display=swap" rel="stylesheet">
  <style>
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    body {
      background: #111322;
      font-family: 'Montserrat', sans-serif;
      height: 100vh; width: 100vw;
    }
    #bg-canvas {
      position: fixed;
      top: 0; left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 0;
      background: #111322;
    }
    /* --- COUNTERS ROW --- */
    .counters-row {
      position: fixed;
      top: 26px;
      left: 26px;
      display: flex;
      flex-direction: row;
      gap: 16px;
      z-index: 20;
      user-select: none;
    }
    .counter-tab {
      background: rgba(20, 26, 44, 0.62);
      box-shadow: 0 4px 22px #323a5a22;
      border-radius: 20px;
      padding: 10px 23px 10px 18px;
      font-size: 1.05em;
      color: #eaf6ff;
      font-weight: 600;
      letter-spacing: 0.5px;
      min-width: 105px;
      backdrop-filter: blur(9px) saturate(140%);
      border: 1px solid rgba(115,145,205,0.12);
      transition: background 0.19s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .counter-label {
      color: #99cfff;
      font-size: 0.97em;
      font-weight: 700;
      margin-right: 4px;
    }
    .counter-value {
      color: #ffffff;
      font-size: 1.09em;
      font-weight: 800;
      margin-left: 4px;
    }
    @media (max-width: 600px) {
      .counters-row {
        top: 9px;
        left: 8px;
        gap: 6px;
      }
      .counter-tab {
        padding: 7px 10px 7px 8px;
        font-size: 0.88em;
        min-width: 74px;
      }
      .counter-label { font-size: 0.9em; }
      .counter-value { font-size: 1em; }
    }
    /* --- MAIN UI --- */
    .center-content {
      position: absolute;
      top: 29vh;
      left: 50%;
      transform: translate(-50%, 0);
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 1;
      width: 100vw;
      pointer-events: none;
    }
    .glass-box {
      background: rgba(20, 23, 40, 0.55);
      box-shadow: 0 4px 48px #22317b55;
      border-radius: 26px;
      padding: 46px 50px 40px 50px;
      min-width: 320px;
      max-width: 90vw;
      display: flex;
      flex-direction: column;
      align-items: center;
      backdrop-filter: blur(11px) saturate(120%);
      border: 1.5px solid rgba(125,170,255,0.09);
      pointer-events: auto;
      transition: background 0.25s;
    }
    .main-title {
      font-size: 2.7em;
      font-weight: 700;
      color: #fff;
      letter-spacing: 3px;
      text-shadow: 0 0 32px #76a8ff99, 0 2px 10px #20254e;
      animation: floatTitle 3.5s ease-in-out infinite;
      white-space: nowrap;
      user-select: none;
      margin-bottom: 44px;
      pointer-events: auto;
      background: linear-gradient(90deg, #88caff 0%, #bf9cff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    @keyframes floatTitle {
      0%, 100% { transform: translateY(0);}
      50% { transform: translateY(-8px);}
    }
    .hold-btn-wrap {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 6px;
    }
    .gen-btn {
      padding: 20px 58px;
      border-radius: 19px;
      background: linear-gradient(95deg, #7b61ffcc 15%, #4ab6fcbb 95%);
      color: #fff;
      font-size: 1.32em;
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      border: none;
      box-shadow: 0 4px 40px #76a8ff33, 0 1.5px 0px #aabfff22;
      cursor: pointer;
      margin-top: 12px;
      letter-spacing: 1px;
      outline: none;
      position: relative;
      overflow: hidden;
      pointer-events: auto;
      transition: background 0.19s, box-shadow 0.18s, transform 0.12s;
      backdrop-filter: blur(6px) saturate(130%);
      opacity: 0.96;
      border: 1.2px solid #8bc1fa33;
    }
    .gen-btn:active {
      transform: scale(0.97);
      background: linear-gradient(95deg, #6343e0dd 15%, #3998ccbb 95%);
    }
    .gen-btn .progress {
      position: absolute;
      left: 0; top: 0;
      height: 100%;
      background: linear-gradient(90deg, #fff8 0%, #7b61ff99 80%);
      border-radius: 19px;
      z-index: 0;
      pointer-events: none;
      width: 0;
      transition: width 0s;
    }
    .gen-btn .btn-text {
      position: relative;
      z-index: 1;
    }
    .hold-text {
      margin-top: 9px;
      color: #b5cfff;
      font-size: 1em;
      font-weight: 500;
      letter-spacing: 1px;
      opacity: 0.77;
      user-select: none;
      pointer-events: none;
      text-align: center;
      font-style: italic;
    }
    @media (max-width: 600px) {
      .main-title {
        font-size: 1.3em;
        margin-bottom: 22px;
      }
      .glass-box {
        min-width: unset;
        padding: 19px 10px 16px 10px;
      }
      .gen-btn {
        font-size: 1em;
        padding: 14px 18vw;
      }
      .center-content {
        top: 19vh;
      }
    }
  </style>
</head>
<body>
  <canvas id="bg-canvas"></canvas>
  <div class="counters-row">
    <div class="counter-tab" id="onlineTab">
      <span class="counter-label">Online Users</span>
      <span class="counter-value" id="onlineCount">1</span>
    </div>
    <div class="counter-tab" id="keysTab">
      <span class="counter-label">Keys Generated</span>
      <span class="counter-value" id="keyCount">0</span>
    </div>
  </div>
  <div class="center-content">
    <div class="glass-box">
      <div class="main-title">Eps1llon Hub</div>
      <div class="hold-btn-wrap">
        <button class="gen-btn" id="holdGenBtn" type="button">
          <div class="progress"></div>
          <span class="btn-text">Generate Key</span>
        </button>
        <div class="hold-text">Hold the button to generate your key</div>
      </div>
    </div>
  </div>
  <script>
    // --- Particles ---
    const canvas = document.getElementById("bg-canvas");
    const ctx = canvas.getContext("2d");
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    let dots = [];
    const DOTS = Math.floor((w * h) / 6000) + 40;
    const maxDist = 170;
    const dotColor = "#8dbfff";
    const lineColor = "rgba(119,175,255,0.18)";
    function randomDot() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        r: Math.random() * 2.5 + 1.3
      };
    }
    function resetDots() {
      dots = [];
      for(let i=0;i<DOTS;i++) dots.push(randomDot());
    }
    resetDots();
    function animate() {
      ctx.clearRect(0,0,w,h);
      for(let i=0;i<dots.length;i++) {
        for(let j=i+1;j<dots.length;j++) {
          let a = dots[i], b = dots[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let dist = Math.sqrt(dx*dx+dy*dy);
          if(dist < maxDist) {
            ctx.beginPath();
            ctx.strokeStyle = lineColor;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineWidth = 1;
            ctx.globalAlpha = (maxDist - dist) / maxDist * 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
      for(let dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI*2);
        ctx.fillStyle = dotColor;
        ctx.shadowColor = "#3e73ff";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      for(let dot of dots) {
        dot.x += dot.vx;
        dot.y += dot.vy;
        if(dot.x < 0 || dot.x > w) dot.vx *= -1;
        if(dot.y < 0 || dot.y > h) dot.vy *= -1;
      }
      requestAnimationFrame(animate);
    }
    animate();
    window.addEventListener("resize", () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w; canvas.height = h;
      resetDots();
    });

    // --- Hold-to-generate logic + Counters ---
    const holdBtn = document.getElementById("holdGenBtn");
    const progressBar = holdBtn.querySelector(".progress");
    let holdTimeout, holdStart;
    let progressFrame;
    const HOLD_TIME = 2000; // ms

    function resetProgress() {
      progressBar.style.width = "0";
    }
    function setProgress(percent) {
      progressBar.style.width = percent * 100 + "%";
    }
    function startHold(e) {
      if (holdTimeout) return;
      holdStart = Date.now();
      setProgress(0);
      function update() {
        const elapsed = Date.now() - holdStart;
        setProgress(Math.min(elapsed / HOLD_TIME, 1));
        if (elapsed >= HOLD_TIME) {
          holdTimeout = null;
          setProgress(1);
          // Call API to increment keys
          fetch("/api/increment-keys", { method: "POST", headers: { "Content-Type": "application/json" }})
            .then(res => res.json())
            .then(d => { /* Optionally show success, etc. */ });
        } else if (holdTimeout !== null) {
          progressFrame = requestAnimationFrame(update);
        }
      }
      holdTimeout = setTimeout(() => {}, HOLD_TIME); // For pointerup logic
      progressFrame = requestAnimationFrame(update);
    }
    function cancelHold() {
      if (holdTimeout) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
      }
      if (progressFrame) cancelAnimationFrame(progressFrame);
      resetProgress();
    }
    holdBtn.addEventListener("mousedown", startHold);
    holdBtn.addEventListener("touchstart", startHold);
    ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach(ev =>
      holdBtn.addEventListener(ev, cancelHold)
    );

    // --- Live Counter Sync ---
    const keyCountEl = document.getElementById("keyCount");
    const onlineCountEl = document.getElementById("onlineCount");
    // Initial fetch
    fetch("/api/counters")
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (keyCountEl) keyCountEl.textContent = data.keysGenerated;
          if (onlineCountEl) onlineCountEl.textContent = data.onlineUsers;
        }
      });
    // WebSocket live update
    let wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    let wsUrl = wsProto + "://" + window.location.host;
    let ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        let data = JSON.parse(event.data);
        if (typeof data.onlineUsers === "number")
          onlineCountEl.textContent = data.onlineUsers;
        if (typeof data.keysGenerated === "number")
          keyCountEl.textContent = data.keysGenerated;
      } catch (e) {}
    };
  </script>
</body>
</html>
