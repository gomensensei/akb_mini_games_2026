let membersDB = [];
let langs = {};
let currentLang = 'zh-HK';
let leaderboard = [];

// 資料清洗引擎
function normalizeMembers(rawList) {
    return rawList.map((m, index) => ({
        id: m.id || String(index),
        name_zh: m.name_zh_hk || m.name_zh_tw || m.name_zh_cn || m.name_zh || m.name_ja || "Unknown",
        name_ja: m.name_ja || m.name || "Unknown",
        name_en: m.name_en || m.name_romaji || m.name_ja || "Unknown",
        genString: m.generation || m.ki_name || (m.ki ? m.ki + '期' : 'Unknown'),
        genNum: parseFloat(m.genNum) || parseFloat(m.ki) || 99,
        image: m.img_url || m.image || m.img || m.photo || "https://placehold.co/300x400/FFB6C1/FFF"
    }));
}

// ⚠️ 注意：讀取獨立 JSON 檔案需要環境支援 (如 Local Server)
async function loadData() {
    try {
        const membersRes = await fetch('members.json');
        const membersRaw = await membersRes.json();
        
        const langsRes = await fetch('langs.json');
        langs = await langsRes.json();
        
        membersDB = normalizeMembers(membersRaw);
        App.init();
    } catch (err) { 
        console.error("載入資料失敗 / Data Load Error:", err); 
        alert("請確保您使用 Local Server (如 VS Code Live Server) 運行，否則瀏覽器會阻擋讀取 JSON 檔案！");
    }
}

// 簡化友善的遊戲名稱
const gameList = [
    { id: 'mem', short_zh: "記憶", name_zh: "成員對對碰", name_ja: "メンバー神経衰弱", name_en: "Memory Match", baseTime: 40000 },
    { id: 'sort', short_zh: "排序", name_zh: "前輩排序", name_ja: "先輩順ソート", name_en: "Senpai Sorter", baseTime: 15000 },
    { id: 'find', short_zh: "尋找", name_zh: "推し找出", name_ja: "推し探し", name_en: "Find Oshi", baseTime: 15000 },
    { id: 'macro', short_zh: "局部", name_zh: "局部解碼", name_ja: "部分解読", name_en: "Detail Decode", baseTime: 15000 },
    { id: 'duel', short_zh: "對決", name_zh: "誰是前輩", name_ja: "先輩は誰？", name_en: "Who is Senpai", baseTime: 5000 },
    { id: 'smile', short_zh: "視窗", name_zh: "笑容探照燈", name_ja: "笑顔サーチ", name_en: "Smile Spotlight", baseTime: 12000 },
    { id: 'puz', short_zh: "拼圖", name_zh: "碎片拼圖", name_ja: "写真パズル", name_en: "Photo Puzzle", baseTime: 25000 }
];

function detectLang() {
    const nav = navigator.language.toLowerCase();
    if (nav.includes('zh-tw') || nav.includes('zh-hant')) currentLang = 'zh-TW';
    else if (nav.includes('zh-cn') || nav.includes('zh-hans')) currentLang = 'zh-CN';
    else if (nav.startsWith('ja')) currentLang = 'ja';
    else if (nav.startsWith('en')) currentLang = 'en';
    else currentLang = 'zh-HK';
    document.getElementById('langSelector').value = currentLang;
    applyLang();
}

function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (langs[currentLang] && langs[currentLang][key]) el.textContent = langs[currentLang][key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (langs[currentLang] && langs[currentLang][key]) el.placeholder = langs[currentLang][key];
    });
    // 即時切換結算畫面語言
    if (!document.getElementById('view-result').classList.contains('hidden')) {
        App.generateResultCanvas();
        document.getElementById('btnShareText').textContent = (App.mode === 'classic') ? langs[currentLang].btn_share_lb : langs[currentLang].btn_share;
    }
}

function getName(member) { return currentLang === 'ja' ? member.name_ja : currentLang === 'en' ? member.name_en : member.name_zh; }
function getGameName(g) { return currentLang === 'ja' ? g.name_ja : currentLang === 'en' ? g.name_en : g.name_zh; }
function getShortName(g) { return currentLang === 'ja' ? g.name_ja : currentLang === 'en' ? g.name_en : g.short_zh; }
function getGenDisplay(member) { return member.genString; }

document.getElementById('langSelector').addEventListener('change', (e) => { currentLang = e.target.value; applyLang(); });

function shuffle(arr) { let a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function triggerConfetti() { confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, colors: ['#FF1493', '#4CAF50', '#00FFFF'], zIndex: 9999 }); }

// Canvas 排版引擎
function drawInfoGraphicText(ctx, startX, startY, textArray) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const totalHeight = textArray.reduce((sum, el) => sum + el.h + el.gap, 0);
    let currentY = startY - (totalHeight / 2);
    textArray.forEach(el => {
        ctx.font = el.font; ctx.fillStyle = el.color;
        if(el.shadow) { ctx.shadowColor = el.shadow; ctx.shadowBlur = 10; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 4; } else { ctx.shadowColor = 'transparent'; }
        if (el.wrapWidth) {
            const words = el.text.split(' '); let line = ''; let yOff = 0;
            for(let i=0; i<words.length; i++) {
                let testLine = line + words[i] + ' ';
                if(ctx.measureText(testLine).width > el.wrapWidth && i > 0) {
                    ctx.fillText(line, startX, currentY + yOff); line = words[i] + ' '; yOff += el.h + 5;
                } else { line = testLine; }
            }
            ctx.fillText(line, startX, currentY + yOff); currentY += el.h + el.gap + yOff;
        } else { ctx.fillText(el.text, startX, currentY); currentY += el.h + el.gap; }
    });
    ctx.shadowColor = 'transparent';
}

// 核心控制器
const App = {
    mode: '', queue: [], currentQIdx: 0, round: 0, maxRounds: 5, score: 0,
    activeGame: null, animFrame: null, timerStart: 0, timeLimit: 0, difficulty: 1,
    delayTimeout: null,

    init() { 
        detectLang(); 
        document.getElementById('btnHome').onclick = this.goHome.bind(this); 
        
        // 處理社交排行榜 URL Parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('lb')) {
            try {
                leaderboard = JSON.parse(decodeURIComponent(escape(atob(urlParams.get('lb')))));
                leaderboard.sort((a,b) => b.s - a.s);
                
                const lbContainer = document.getElementById('lbContainer');
                const lbList = document.getElementById('lbList');
                lbList.innerHTML = '';
                leaderboard.forEach((entry, i) => {
                    let itemClass = i===0 ? 'lb-item highlight' : 'lb-item';
                    lbList.innerHTML += `<li class="${itemClass}"><span>#${i+1} ${entry.n}</span> <span style="color:var(--primary)">${entry.s} pts</span></li>`;
                });
                lbContainer.classList.remove('hidden');
            } catch(e) { console.error("Leaderboard Parse Error", e); }
        }
    },

    showModal(mode) {
        const title = document.getElementById('modalTitle'), content = document.getElementById('modalContent'); content.innerHTML = '';
        document.getElementById('view-dashboard').classList.add('dashboard-blurred');
        
        if (mode === 'casual' || mode === 'challenge') {
            title.textContent = langs[currentLang][`mode_${mode}`];
            gameList.forEach((g, i) => { content.innerHTML += `<label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:10px; background:rgba(255,255,255,0.5); border-radius:10px;"><input type="radio" name="gSel" value="${g.id}" ${i===0?'checked':''}> <b>${getGameName(g)}</b></label>`; });
        } else if (mode === 'custom') {
            title.textContent = langs[currentLang].mode_custom;
            gameList.forEach(g => { content.innerHTML += `<label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:10px; background:rgba(255,255,255,0.5); border-radius:10px;"><input type="checkbox" class="gCheck" value="${g.id}" checked> <b>${getGameName(g)}</b></label>`; });
        }
        document.getElementById('modalConfirmBtn').onclick = () => {
            if (mode === 'casual' || mode === 'challenge') { this.startMode(mode, [document.querySelector('input[name="gSel"]:checked').value]); } 
            else if (mode === 'custom') {
                const sels = Array.from(document.querySelectorAll('.gCheck:checked')).map(cb => cb.value);
                if(sels.length === 0) return alert("Please select at least one game!"); this.startMode(mode, sels);
            }
        };
        document.getElementById('selectionModal').classList.remove('hidden');
    },

    hideModal() { 
        document.getElementById('view-dashboard').classList.remove('dashboard-blurred');
        document.getElementById('selectionModal').classList.add('hidden'); 
    },

    startMode(mode, selectedIds = []) {
        this.hideModal(); this.mode = mode; this.score = 0; this.currentQIdx = 0; document.getElementById('scoreDisplay').textContent = 0;
        this.queue = (mode === 'classic') ? gameList.map(g => g.id) : selectedIds;
        
        document.getElementById('view-dashboard').className = 'hidden'; document.getElementById('view-result').className = 'hidden';
        document.getElementById('view-game').className = 'game-wrapper stage-enter';
        setTimeout(() => { document.getElementById('view-game').className = 'game-wrapper stage-active'; document.getElementById('globalTimerBar').classList.remove('hidden'); document.getElementById('btnHome').classList.remove('hidden'); document.getElementById('gameTitleHint').classList.remove('hidden'); this.loadNextGameInQueue(); }, 50);
    },

    loadNextGameInQueue() {
        if (this.currentQIdx >= this.queue.length || this.mode === '') { this.showFinalResult(); return; }
        const gId = this.queue[this.currentQIdx]; this.round = 0; this.activeGame = Games[gId];
        
        if (this.mode === 'classic' && gId === 'mem') this.maxRounds = 1;
        else this.maxRounds = (this.mode === 'challenge') ? 50 : 5;

        document.querySelectorAll('#view-game > div').forEach(div => { if(div.id.startsWith('container-')) div.classList.add('hidden'); });
        document.getElementById(`container-${gId}`).classList.remove('hidden');
        this.nextRound();
    },

    nextRound() {
        if (this.mode === '') return; 
        if (this.round >= this.maxRounds) { this.currentQIdx++; this.loadNextGameInQueue(); return; }
        this.round++; document.getElementById('gameTitleHint').textContent = `${getGameName(gameList.find(g=>g.id===this.queue[this.currentQIdx]))} - ${this.round}/${this.maxRounds}`;
        
        if (this.mode === 'challenge') {
            // 極限模式加強難度，壓縮時間
            this.difficulty = Math.min(1 + (this.round * 0.1), 5); 
            const baseT = gameList.find(g=>g.id===this.queue[this.currentQIdx]).baseTime;
            this.timeLimit = Math.max(baseT * (1 - this.round * 0.02), baseT * 0.2);
        } else { this.difficulty = 1; this.timeLimit = gameList.find(g=>g.id===this.queue[this.currentQIdx]).baseTime; }

        document.getElementById(`container-${this.queue[this.currentQIdx]}`).classList.add('stage-exit');
        setTimeout(() => {
            if (this.mode === '') return;
            this.activeGame.setup(); const c = document.getElementById(`container-${this.queue[this.currentQIdx]}`);
            c.classList.remove('stage-exit'); c.classList.add('stage-enter'); void c.offsetWidth; c.classList.remove('stage-enter'); c.classList.add('stage-active');
            setTimeout(() => this.startTimer(), 400);
        }, 400);
    },

    startTimer() {
        if(this.mode === '') return;
        this.timerStart = performance.now(); this.activeGame.isActive = true;
        const tf = document.getElementById('globalTimerFill'); tf.parentElement.classList.remove('timer-danger');
        const loop = () => {
            if (!this.activeGame.isActive) return;
            const p = (performance.now() - this.timerStart) / this.timeLimit;
            if (p >= 1) { tf.style.transform = `scaleX(0)`; this.activeGame.onTimeOut(); return; }
            tf.style.transform = `scaleX(${1 - p})`; if (p > 0.7) tf.parentElement.classList.add('timer-danger');
            if (this.activeGame.onFrame) this.activeGame.onFrame(p);
            this.animFrame = requestAnimationFrame(loop);
        };
        this.animFrame = requestAnimationFrame(loop);
    },

    addScore(base, timeRatio) {
        this.score += Math.floor(base * this.difficulty * (1 + timeRatio));
        const sd = document.getElementById('scoreDisplay'); sd.textContent = this.score;
        sd.style.transform = 'scale(1.4)'; setTimeout(()=>sd.style.transform='scale(1)', 300);
    },

    getDelay(baseMs) {
        return this.mode === 'challenge' ? Math.max(baseMs * 0.3, 400) : baseMs;
    },

    roundEndDelay(ms = 1500) { 
        this.activeGame.isActive = false; cancelAnimationFrame(this.animFrame); 
        document.getElementById('globalTimerFill').style.transform = 'scaleX(0)'; 
        this.delayTimeout = setTimeout(() => this.nextRound(), this.getDelay(ms)); 
    },

    calculateRank() {
        let maxPossible = this.queue.length * this.maxRounds * 2000; 
        if(this.mode === 'classic') maxPossible = (1 * 2000) + (6 * 5 * 2000); 
        if(this.mode === 'challenge') maxPossible *= 1.5;
        const ratio = this.score / (maxPossible || 1);
        
        if(ratio > 0.8) return { badge: "👑", key: "r1" };
        if(ratio > 0.6) return { badge: "🌟", key: "r2" };
        if(ratio > 0.4) return { badge: "🔥", key: "r3" };
        if(ratio > 0.2) return { badge: "🐣", key: "r4" };
        return { badge: "☕", key: "r5" };
    },

    getPlayedGamesStr() {
        const label = langs[currentLang].played_label || "Played: ";
        const names = this.queue.map(id => getShortName(gameList.find(g=>g.id===id))).join(', ');
        return `${label} ${names}`;
    },

    generateResultCanvas() {
        const canvas = document.createElement('canvas'); const scale = 3; const w = 400, h = 600;
        canvas.width = w * scale; canvas.height = h * scale; const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);

        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#e0eafc'); grad.addColorStop(0.5, '#cfdef3'); grad.addColorStop(1, '#FFB6C1');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
        ctx.beginPath(); ctx.roundRect(20, 20, w - 40, h - 40, 20); ctx.fill(); ctx.shadowColor = 'transparent';

        const rank = this.calculateRank();
        const modeName = langs[currentLang][`mode_${this.mode}`].replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, '').trim();

        const texts = [
            { text: langs[currentLang].app_title, font: "bold 20px 'Noto Sans JP'", color: "#7F8C8D", h: 20, gap: 40 },
            { text: rank.badge, font: "60px 'Noto Sans JP'", color: "#000", h: 60, gap: 15 },
            { text: langs[currentLang][rank.key], font: "900 36px 'Noto Sans JP'", color: "#FF4081", h: 36, gap: 5, shadow: "rgba(255,64,129,0.3)" },
            { text: modeName, font: "bold 18px 'Noto Sans JP'", color: "#2C3E50", h: 18, gap: 15 },
            { text: this.getPlayedGamesStr(), font: "bold 12px 'Noto Sans JP'", color: "#7F8C8D", h: 12, gap: 40, wrapWidth: 320 },
            { text: "TOTAL SCORE", font: "bold 14px 'Noto Sans JP'", color: "#7F8C8D", h: 14, gap: 5 },
            { text: this.score.toString(), font: "900 48px 'Noto Sans JP'", color: "#2C3E50", h: 48, gap: 0 }
        ];
        
        drawInfoGraphicText(ctx, w/2, h/2, texts);
        document.getElementById('resultCanvasPreview').src = canvas.toDataURL('image/png');
    },

    showFinalResult() {
        if (this.mode === '') return; 
        this.generateResultCanvas();

        if (this.mode === 'classic') {
            document.getElementById('playerName').classList.remove('hidden');
            document.getElementById('btnShareText').textContent = langs[currentLang].btn_share_lb;
        } else {
            document.getElementById('playerName').classList.add('hidden');
            document.getElementById('btnShareText').textContent = langs[currentLang].btn_share;
        }

        document.getElementById('view-game').className = 'game-wrapper stage-exit';
        setTimeout(() => {
            if (this.mode === '') return; 
            document.getElementById('view-game').className = 'hidden';
            document.getElementById('globalTimerBar').classList.add('hidden');
            document.getElementById('gameTitleHint').classList.add('hidden');
            
            const rv = document.getElementById('view-result');
            rv.className = 'stage-enter'; void rv.offsetWidth; rv.className = 'stage-active';
            triggerConfetti(); setTimeout(triggerConfetti, 500); setTimeout(triggerConfetti, 1000);
        }, 400);
    },

    downloadResult() {
        try {
            const link = document.createElement('a');
            link.download = `AKB48_FanQuest_${this.score}.png`;
            link.href = document.getElementById('resultCanvasPreview').src;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch(e) {
            document.getElementById('exportImgDisplay').src = document.getElementById('resultCanvasPreview').src;
            document.getElementById('downloadModal').classList.remove('hidden');
        }
    },

    shareToX() {
        const rank = this.calculateRank(), title = langs[currentLang][rank.key];
        const modeName = langs[currentLang][`mode_${this.mode}`].replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, '').trim();
        
        let shareUrl = window.location.href.split('?')[0]; 
        
        if (this.mode === 'classic') {
            const nameInput = document.getElementById('playerName').value.trim() || 'Anonymous';
            let newLb = [...leaderboard, { n: nameInput, s: this.score }];
            newLb.sort((a,b) => b.s - a.s);
            newLb = newLb.slice(0, 10); 
            const b64Data = btoa(unescape(encodeURIComponent(JSON.stringify(newLb))));
            shareUrl = window.location.origin + window.location.pathname + '?lb=' + b64Data;
        }

        let text = '';
        if(currentLang === 'ja') {
            text = `【AKB48 ファン入門テスト】(${modeName}) で「${title}」を獲得！スコア：${this.score}点！`;
            if(this.mode === 'classic') text += `私の記録を破れるか？\n\n${shareUrl}\n\n#AKB48`; else text += `\n\n#AKB48`;
        } else if(currentLang === 'en') {
            text = `I reached [${title}] in AKB48 Fan Quest (${modeName}) with ${this.score} points!`;
            if(this.mode === 'classic') text += ` Can you beat me?\n\n${shareUrl}\n\n#AKB48`; else text += `\n\n#AKB48`;
        } else {
            text = `我喺【AKB48 粉絲入門挑戰】(${modeName}) 獲得「${title}」稱號！總分：${this.score}分！`;
            if(this.mode === 'classic') text += `能打破我的紀錄嗎？\n\n${shareUrl}\n\n#AKB48`; else text += `\n\n#AKB48`;
        }
        window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(text), '_blank');
    },

    goHome() {
        this.mode = ''; clearTimeout(this.delayTimeout); 
        if(this.activeGame) this.activeGame.isActive = false; cancelAnimationFrame(this.animFrame);
        document.getElementById('view-game').className = 'hidden'; document.getElementById('view-result').className = 'hidden';
        document.getElementById('globalTimerBar').classList.add('hidden'); document.getElementById('btnHome').classList.add('hidden'); document.getElementById('gameTitleHint').classList.add('hidden');
        document.getElementById('view-dashboard').className = 'stage-enter'; 
        document.getElementById('view-dashboard').classList.remove('dashboard-blurred');
        setTimeout(() => document.getElementById('view-dashboard').className = 'stage-active', 50);
    }
};

// ==========================================
// Games Object
// ==========================================
const Games = {
    mem: {
        isActive: false, pairs: 0, flipped: [], lock: false,
        setup() {
            const c = document.getElementById('container-mem'); c.innerHTML = ''; this.pairs = 0; this.flipped = []; this.lock = false;
            let m = shuffle(membersDB).slice(0, 8); let cards = shuffle([...m, ...m]);
            cards.forEach(mem => {
                const el = document.createElement('div'); el.className = 'mem-card'; el.dataset.id = mem.id;
                el.innerHTML = `<div class="mem-inner"><div class="mem-face mem-back">AKB</div><div class="mem-face mem-front"><img src="${mem.image}" crossorigin="anonymous" onerror="this.src='https://placehold.co/100x100/FFB6C1/FFF'"><div class="mem-name">${getName(mem)}</div></div></div>`;
                el.onclick = () => {
                    if(!this.isActive || this.lock || el.classList.contains('flipped') || el.classList.contains('matched')) return;
                    el.classList.add('flipped'); this.flipped.push(el);
                    if(this.flipped.length===2) {
                        this.lock = true;
                        if(this.flipped[0].dataset.id === this.flipped[1].dataset.id) {
                            this.pairs++;
                            setTimeout(() => { this.flipped.forEach(f=>f.classList.add('matched')); this.flipped=[]; this.lock=false; 
                                if(this.pairs===8) { App.addScore(1000, 1-(performance.now()-App.timerStart)/App.timeLimit); if(App.mode!=='challenge') triggerConfetti(); App.roundEndDelay(1500); }
                            }, App.getDelay(500));
                        } else { setTimeout(() => { this.flipped.forEach(f=>f.classList.remove('flipped')); this.flipped=[]; this.lock=false; }, App.getDelay(1000)); }
                    }
                }; c.appendChild(el);
            });
        },
        onTimeOut() { document.querySelectorAll('.mem-card').forEach(c=>c.classList.add('flipped')); App.roundEndDelay(2500); }
    },
    sort: {
        isActive: false, picks: [], correctIds: [],
        setup() {
            const c = document.getElementById('container-sort'); c.innerHTML = ''; this.picks = [];
            let pool = shuffle(membersDB), opts = [], used = new Set();
            for(let m of pool) { if(!used.has(m.genNum)) { opts.push(m); used.add(m.genNum); } if(opts.length===4) break; }
            this.correctIds = [...opts].sort((a,b)=>a.genNum - b.genNum).map(m=>m.id);
            shuffle(opts).forEach(mem => {
                const el = document.createElement('div'); el.className = 'sort-card'; el.dataset.id = mem.id;
                el.innerHTML = `<div class="sort-badge"></div><img src="${mem.image}" crossorigin="anonymous" onerror="this.src='https://placehold.co/100x100/FFB6C1/FFF'"><div class="sort-gen">${getGenDisplay(mem)}</div><div style="padding:6px;text-align:center;font-weight:900;background:#fff;font-size:0.8rem;">${getName(mem)}</div>`;
                el.onclick = () => {
                    if(!this.isActive) return;
                    if(el.classList.contains('selected')) { el.classList.remove('selected'); this.picks.splice(this.picks.indexOf(mem.id),1); c.querySelectorAll('.sort-card.selected').forEach(x=>x.querySelector('.sort-badge').textContent=this.picks.indexOf(x.dataset.id)+1); return; }
                    el.classList.add('selected'); this.picks.push(mem.id); el.querySelector('.sort-badge').textContent = this.picks.length;
                    if(this.picks.length===4) {
                        this.isActive = false;
                        if(this.picks.every((id,i)=>id===this.correctIds[i])) {
                            c.querySelectorAll('.sort-card').forEach(x=>{ x.classList.add('correct','revealed'); x.querySelector('.sort-badge').textContent=this.correctIds.indexOf(x.dataset.id)+1;});
                            App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); if(App.mode!=='challenge') triggerConfetti(); App.roundEndDelay(2000);
                        } else {
                            c.classList.add('shake'); c.querySelectorAll('.sort-card').forEach(x=>x.classList.add('wrong')); App.score = Math.max(0, App.score-200); document.getElementById('scoreDisplay').textContent = App.score;
                            setTimeout(() => { c.classList.remove('shake'); c.querySelectorAll('.sort-card').forEach(x=>{x.classList.remove('wrong','selected'); x.querySelector('.sort-badge').textContent='';}); this.picks=[]; this.isActive=true; }, App.getDelay(800));
                        }
                    }
                }; c.appendChild(el);
            });
        },
        onTimeOut() { document.querySelectorAll('.sort-card').forEach(c=>c.classList.add('wrong','revealed')); App.roundEndDelay(2000); }
    },
    find: {
        isActive: false, nodes: [], target: null,
        setup() {
            const c = document.getElementById('container-find'); c.innerHTML = ''; c.classList.remove('dimmed'); this.nodes = [];
            this.target = membersDB[Math.floor(Math.random()*membersDB.length)];
            document.getElementById('gameTitleHint').innerHTML = `${langs[currentLang].find_hint}<span style="color:#2196F3">${getName(this.target)}</span>`;
            let pool = [this.target]; while(pool.length<25) pool.push(membersDB.filter(m=>m.id!==this.target.id)[Math.floor(Math.random()*(membersDB.length-1))]);
            
            const rect = c.getBoundingClientRect() || {width:300, height:300}; 
            const ns = window.innerWidth > 768 ? 90 : 65; 
            
            shuffle(pool).forEach(mem => {
                const el = document.createElement('div'); el.className = 'fly-node'; el.innerHTML = `<img src="${mem.image}" crossorigin="anonymous" onerror="this.src='https://placehold.co/100x100/FFB6C1/FFF'">`;
                let x = Math.random()*(rect.width-ns), y = Math.random()*(rect.height-ns), a = Math.random()*Math.PI*2;
                let speedMod = window.innerWidth > 768 ? 0.6 : 0.8;
                let s = (Math.random()*1.0 + 0.3) * speedMod * App.difficulty; 

                el.style.width = ns + 'px'; el.style.height = ns + 'px';
                el.style.transform = `translate(${x}px, ${y}px)`;
                
                el.onclick = (e) => {
                    e.stopPropagation(); if(!this.isActive) return;
                    if(mem.id === this.target.id) {
                        this.isActive = false; el.classList.add('correct'); c.classList.add('dimmed');
                        el.style.transform = `translate(${rect.width/2 - ns/2}px, ${rect.height/2 - ns/2}px) scale(2)`;
                        App.addScore(1000, 1-(performance.now()-App.timerStart)/App.timeLimit); if(App.mode!=='challenge') triggerConfetti(); App.roundEndDelay(2500);
                    } else { App.score = Math.max(0, App.score-50); document.getElementById('scoreDisplay').textContent=App.score; el.style.borderColor='red'; setTimeout(()=>el.style.borderColor='#fff', 300); }
                }; c.appendChild(el); this.nodes.push({el, x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, size:ns});
            });
        },
        onFrame() {
            const rect = document.getElementById('container-find').getBoundingClientRect();
            this.nodes.forEach(n => {
                n.x += n.vx; n.y += n.vy;
                if(n.x<=0){n.x=0; n.vx*=-1;} if(n.x+n.size>=rect.width){n.x=rect.width-n.size; n.vx*=-1;}
                if(n.y<=0){n.y=0; n.vy*=-1;} if(n.y+n.size>=rect.height){n.y=rect.height-n.size; n.vy*=-1;}
                n.el.style.transform = `translate(${n.x}px, ${n.y}px)`;
            });
        },
        onTimeOut() { document.getElementById('container-find').classList.add('dimmed'); this.nodes.find(n=>n.el.querySelector('img').src===this.target.image).el.classList.add('correct'); App.roundEndDelay(2000); }
    },
    macro: {
        isActive: false, target: null, px:0, py:0, zoom:6,
        setup() {
            const img = document.getElementById('macroImg'), opts = document.getElementById('macroOpts'); opts.innerHTML=''; img.style.transition = 'none';
            let pool = shuffle(membersDB).slice(0,4); this.target = pool[0]; pool = shuffle(pool); img.src = this.target.image;
            this.zoom = 5 + (App.difficulty * 1.5); 
            this.px = (Math.random()*70)-35; this.py = (Math.random()*70)-35;
            img.style.transform = `scale(${this.zoom}) translate(${this.px}%, ${this.py}%)`;
            pool.forEach(m => {
                const b = document.createElement('button'); b.className = 'opt-btn'; b.textContent = getName(m);
                b.onclick = () => {
                    if(!this.isActive) return; this.isActive=false;
                    img.style.transition = `transform ${App.getDelay(600)}ms ease`; img.style.transform = 'scale(1) translate(0,0)';
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); if(App.mode!=='challenge') triggerConfetti(); }
                    else { b.classList.add('wrong'); Array.from(opts.children).find(x=>x.textContent===getName(this.target)).classList.add('correct'); }
                    App.roundEndDelay(2500);
                }; opts.appendChild(b);
            });
        },
        onFrame(p) { document.getElementById('macroImg').style.transform = `scale(${this.zoom - ((this.zoom-1)*p)}) translate(${this.px*(1-p)}%, ${this.py*(1-p)}%)`; },
        onTimeOut() { document.getElementById('macroImg').style.transition = `transform ${App.getDelay(600)}ms ease`; document.getElementById('macroImg').style.transform = 'scale(1)'; Array.from(document.getElementById('macroOpts').children).find(x=>x.textContent===getName(this.target)).classList.add('correct'); App.roundEndDelay(2000); }
    },
    duel: {
        isActive: false, mA: null, mB: null,
        setup() {
            const c = document.getElementById('container-duel'); c.innerHTML = '<div class="duel-vs">VS</div>';
            let m1, m2; do { m1=membersDB[Math.floor(Math.random()*membersDB.length)]; m2=membersDB[Math.floor(Math.random()*membersDB.length)]; } while(m1.genNum === m2.genNum);
            this.mA = m1; this.mB = m2;
            [m1, m2].forEach((m, i) => {
                const el = document.createElement('div'); el.className = 'duel-card'; el.id = `duel${i}`;
                el.innerHTML = `<img src="${m.image}" crossorigin="anonymous" onerror="this.src='https://placehold.co/200x300/FFB6C1/FFF'"><div class="duel-gen">${getGenDisplay(m)}</div><div style="padding:10px;text-align:center;font-weight:900;background:#fff;font-size:1rem;">${getName(m)}</div>`;
                el.onclick = () => {
                    if(!this.isActive) return; this.isActive=false;
                    const isA = i===0; const isCorrect = isA ? (m1.genNum < m2.genNum) : (m2.genNum < m1.genNum);
                    document.getElementById('duel0').classList.add('revealed'); document.getElementById('duel1').classList.add('revealed');
                    if(isCorrect) { el.classList.add('correct'); App.addScore(600, 1-(performance.now()-App.timerStart)/App.timeLimit); if(App.mode!=='challenge') triggerConfetti(); }
                    else { el.classList.add('wrong'); c.style.animation='shake 0.4s'; document.getElementById(`duel${isA?1:0}`).classList.add('correct'); }
                    App.roundEndDelay(1500);
                }; c.appendChild(el);
            });
        },
        onTimeOut() { document.getElementById('duel0').classList.add('wrong','revealed'); document.getElementById('duel1').classList.add('wrong','revealed'); App.roundEndDelay(1500); }
    },
    smile: {
        isActive: false, target: null, baseMask: 70, vx: 0, vy: 0, mx: 50, my: 50,
        setup() {
            const view = document.getElementById('smileView'), opts = document.getElementById('smileOpts'); opts.innerHTML='';
            let pool = shuffle(membersDB).slice(0,4); this.target = pool[0]; pool = shuffle(pool); document.getElementById('smileSharp').src = this.target.image;
            
            this.baseMask = Math.max(50 - (App.difficulty * 5), 25); 
            this.mx = Math.random()*60+20; this.my = Math.random()*60+20;
            this.vx = (Math.random()-0.5)*1.2; this.vy = (Math.random()-0.5)*1.2; 
            
            const frosted = document.getElementById('smileFrosted'); 
            frosted.style.transition = 'none'; view.classList.remove('revealed');
            
            pool.forEach(m => {
                const b = document.createElement('button'); b.className = 'opt-btn'; b.textContent = getName(m);
                b.onclick = () => {
                    if(!this.isActive) return; this.isActive=false; 
                    view.classList.add('revealed'); 
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); if(App.mode!=='challenge') triggerConfetti(); } else { b.classList.add('wrong'); Array.from(opts.children).find(x=>x.textContent===getName(this.target)).classList.add('correct'); }
                    App.roundEndDelay(2500);
                }; opts.appendChild(b);
            });
        },
        onFrame(p) { 
            this.mx += this.vx; this.my += this.vy;
            if(this.mx < 10 || this.mx > 90) this.vx *= -1; if(this.my < 10 || this.my > 90) this.vy *= -1;
            const view = document.getElementById('smileView');
            view.style.setProperty('--mask-x', `${this.mx}%`); view.style.setProperty('--mask-y', `${this.my}%`);
            view.style.setProperty('--mask-size', `${this.baseMask * (1 - (p * 0.3))}px`); 
        },
        onTimeOut() { 
            document.getElementById('smileView').classList.add('revealed');
            Array.from(document.getElementById('smileOpts').children).find(x=>x.textContent===getName(this.target)).classList.add('correct'); App.roundEndDelay(2000); 
        }
    },
    puz: {
        isActive: false, state: [], sel: null, target: null,
        setup() {
            const c = document.getElementById('puzGrid'); Array.from(c.children).forEach(x=> {if(x.id!=='puzOverlay') x.remove()}); document.getElementById('puzOverlay').style.opacity = 0;
            this.target = membersDB[Math.floor(Math.random()*membersDB.length)]; document.getElementById('puzOverlay').src = this.target.image; this.state = []; this.sel = null;
            for(let i=0; i<9; i++) this.state.push({id:i, pos:i, rot:Math.floor(Math.random()*4)});
            for(let i=8; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [this.state[i].pos, this.state[j].pos] = [this.state[j].pos, this.state[i].pos]; }
            if(this.state.every(p=>p.id===p.pos && p.rot===0)) this.state[0].rot = 1; this.render();
        },
        render() {
            const c = document.getElementById('puzGrid'); Array.from(c.children).forEach(x=> {if(x.id!=='puzOverlay') x.remove()});
            for(let pos=0; pos<9; pos++) {
                const pData = this.state.find(p=>p.pos===pos); const el = document.createElement('div'); el.className = `puz-piece ${this.sel===pos?'selected':''}`;
                el.innerHTML = `<div class="puz-img" style="background-image:url(${this.target.image}); background-position:${(pData.id%3)*50}% ${Math.floor(pData.id/3)*50}%; transform:rotate(${pData.rot*90}deg)"></div>`;
                el.onclick = () => {
                    if(!this.isActive) return;
                    if(this.sel===null) { this.sel=pos; this.render(); } else if(this.sel===pos) { pData.rot=(pData.rot+1)%4; this.sel=null; this.render(); this.check(); } else { const p1 = this.state.find(p=>p.pos===this.sel); p1.pos=pos; pData.pos=this.sel; this.sel=null; this.render(); this.check(); }
                }; c.insertBefore(el, document.getElementById('puzOverlay'));
            }
        },
        check() { if(this.state.every(p=>p.id===p.pos && p.rot===0)) { this.isActive=false; document.getElementById('puzOverlay').style.opacity = 1; App.addScore(1200, 1-(performance.now()-App.timerStart)/App.timeLimit); if(App.mode!=='challenge') triggerConfetti(); App.roundEndDelay(2500); } },
        onTimeOut() { document.getElementById('puzOverlay').style.opacity = 1; App.roundEndDelay(2000); }
    }
};

window.onload = () => loadData();
    </script>
</body>
</html>
