let membersDB = [];
let langs = {};
let currentLang = 'zh-HK';
let leaderboard = [];

// ==========================================
// 資料清洗引擎 (加入韓文過濾與容錯)
// ==========================================
function normalizeMembers(rawList) {
    return rawList.map((m, index) => {
        // 過濾錯誤的韓文 Kana
        let kana = m.name_kana || "";
        if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(kana)) kana = "";

        // 應援色提取
        let c1 = "#FF4081", c2 = "#FFB6C1";
        if (m.colorData && m.colorData.length > 0) {
            c1 = m.colorData[0].color;
            c2 = m.colorData.length > 1 ? m.colorData[1].color : c1;
        }
        
        return {
            id: String(m.id || index),
            name_ja: m.name_ja || m.name || "Unknown",
            name_kana: kana,
            name_zh: m.name_zh_tw || m.name_zh_hk || m.name_zh_cn || m.name_zh || m.name_ja || "Unknown",
            name_en: m.name_en || m.name_romaji || m.name_ja || "Unknown",
            name_ko: m.name_ko || m.name_ja || "Unknown",
            name_th: m.name_th || m.name_en || m.name_ja || "Unknown",
            nickname: m.nickname || "",
            genString: m.ki || m.generation || "Unknown",
            genNum: parseFloat(m.genNum) || parseFloat(m.ki) || 99,
            image: m.img_url || m.image || m.img || m.photo || "https://placehold.co/300x400/FFB6C1/FFF",
            c1: c1,
            c2: c2
        };
    });
}

// 載入資料
async function loadData() {
    try {
        const [mRes, lRes] = await Promise.all([ fetch('members.json'), fetch('langs.json') ]);
        if (!mRes.ok || !lRes.ok) throw new Error("JSON files not found");
        const mRaw = await mRes.json();
        langs = await lRes.json();
        membersDB = normalizeMembers(mRaw);
        App.init();
    } catch (err) {
        console.error("Data Load Error:", err);
        alert("載入資料失敗！請確保 members.json 和 langs.json 存在於正確目錄。");
    }
}

const gameList = [
    { id: 'mem', baseTime: 40000 }, { id: 'sort', baseTime: 15000 }, { id: 'find', baseTime: 15000 },
    { id: 'macro', baseTime: 15000 }, { id: 'duel', baseTime: 5000 }, { id: 'smile', baseTime: 12000 }, { id: 'puz', baseTime: 25000 }
];

function detectLang() {
    const nav = navigator.language.toLowerCase();
    if (nav.includes('tw') || nav.includes('hant')) currentLang = 'zh-TW';
    else if (nav.includes('cn') || nav.includes('hans')) currentLang = 'zh-CN';
    else if (nav.startsWith('ja')) currentLang = 'ja';
    else if (nav.startsWith('ko')) currentLang = 'ko';
    else if (nav.startsWith('th')) currentLang = 'th';
    else if (nav.startsWith('id')) currentLang = 'id';
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
    if (App.mode !== '' && document.getElementById('gameTitleHint')) {
        document.getElementById('gameTitleHint').textContent = `${getGameName(gameList.find(g=>g.id===App.queue[App.currentQIdx]))} - ${App.round}/${App.maxRounds}`;
    }
    if (!document.getElementById('view-result').classList.contains('hidden')) {
        App.generateResultCanvas();
        document.getElementById('btnShareText').textContent = (App.mode === 'classic') ? langs[currentLang].btn_share_lb : langs[currentLang].btn_share;
    }
}

function getDisplayName(member) {
    if (['zh-HK', 'zh-TW', 'zh-CN', 'ja'].includes(currentLang)) return member.name_ja;
    if (currentLang === 'ko') return member.name_ko;
    if (currentLang === 'th') return member.name_th;
    return member.name_en; 
}

function getRubyNameHTML(member) {
    if (['zh-HK', 'zh-TW', 'zh-CN', 'ja'].includes(currentLang) && member.name_kana) {
        return `<ruby>${member.name_ja}<rt>${member.name_kana}</rt></ruby>`;
    }
    return getDisplayName(member);
}

function getGameName(g) { return langs[currentLang] ? langs[currentLang]['gn_' + g.id] : g.id; }
function getShortName(g) { return langs[currentLang] ? langs[currentLang]['gs_' + g.id] : g.id; }
function getGenDisplay(member) { return member.genString; }

document.getElementById('langSelector').addEventListener('change', (e) => { currentLang = e.target.value; applyLang(); });

function shuffle(arr) { let a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function triggerConfetti() { 
    if (App.mode === 'challenge') return; 
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, colors: ['#FF1493', '#4CAF50', '#00FFFF'], zIndex: 9999 }); 
}

// 繪製圓角矩形 (完美兼容舊版 iOS/Safari)
function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

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
                if(ctx.measureText(testLine).width > el.wrapWidth && i > 0) { ctx.fillText(line, startX, currentY + yOff); line = words[i] + ' '; yOff += el.h + 5; } else { line = testLine; }
            }
            ctx.fillText(line, startX, currentY + yOff); currentY += el.h + el.gap + yOff;
        } else { ctx.fillText(el.text, startX, currentY); currentY += el.h + el.gap; }
    });
    ctx.shadowColor = 'transparent';
}

// 主程式 App
const App = {
    mode: '', queue: [], currentQIdx: 0, round: 0, maxRounds: 5, score: 0,
    activeGame: null, animFrame: null, timerStart: 0, timeLimit: 0, difficulty: 1,
    delayTimeout: null, lastTarget: null,

    init() {
        detectLang();
        document.getElementById('btnHome').onclick = () => this.goHome();
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('lb')) {
            try { leaderboard = JSON.parse(decodeURIComponent(escape(atob(urlParams.get('lb'))))); this.renderLeaderboard(); } catch(e) {}
        }
    },

    renderLeaderboard() {
        const lbList = document.getElementById('lbList'); lbList.innerHTML = '';
        leaderboard.sort((a,b)=>b.s-a.s).slice(0,10).forEach((entry, i) => {
            let itemClass = i === 0 ? 'lb-item highlight' : 'lb-item';
            lbList.innerHTML += `<li class="${itemClass}"><span>#${i+1} ${entry.n}</span> <span style="color:var(--primary)">${entry.s} pts</span></li>`;
        });
        document.getElementById('lbContainer').classList.remove('hidden');
    },

    showModal(mode) {
        document.getElementById('view-dashboard').classList.add('dashboard-blurred');
        const title = document.getElementById('modalTitle'), content = document.getElementById('modalContent');
        content.innerHTML = ''; title.textContent = langs[currentLang][`mode_${mode}`];
        if (mode === 'custom') {
            gameList.forEach(g => content.innerHTML += `<label style="display:flex;gap:10px;padding:8px;"><input type="checkbox" class="gCheck" value="${g.id}" checked><b>${getGameName(g)}</b></label>`);
        } else {
            gameList.forEach((g,i) => content.innerHTML += `<label style="display:flex;gap:10px;padding:8px;"><input type="radio" name="gSel" value="${g.id}" ${i===0?'checked':''}><b>${getGameName(g)}</b></label>`);
        }
        document.getElementById('modalConfirmBtn').onclick = () => {
            let ids = mode==='custom' ? Array.from(document.querySelectorAll('.gCheck:checked')).map(c=>c.value) : [document.querySelector('input[name="gSel"]:checked').value];
            if(ids.length) this.startMode(mode, ids);
        };
        document.getElementById('selectionModal').classList.remove('hidden');
    },

    hideModal() { document.getElementById('view-dashboard').classList.remove('dashboard-blurred'); document.getElementById('selectionModal').classList.add('hidden'); },

    startMode(mode, ids = []) {
        this.hideModal(); this.mode = mode; this.score = 0; this.currentQIdx = 0; document.getElementById('scoreDisplay').textContent = 0;
        this.queue = mode === 'classic' ? gameList.map(g=>g.id) : ids;
        document.getElementById('view-dashboard').classList.add('hidden'); document.getElementById('view-game').classList.remove('hidden');
        document.getElementById('btnHome').classList.remove('hidden'); document.getElementById('globalTimerBar').classList.remove('hidden'); document.getElementById('gameTitleHint').classList.remove('hidden');
        this.loadNextGameInQueue();
    },

    loadNextGameInQueue() {
        if (this.currentQIdx >= this.queue.length || this.mode === '') { this.showFinalResult(); return; }
        const gId = this.queue[this.currentQIdx]; this.round = 0; this.activeGame = Games[gId];
        this.maxRounds = (this.mode === 'classic' && gId === 'mem') ? 1 : (this.mode === 'challenge' ? 50 : 5);
        document.querySelectorAll('#view-game > div').forEach(div => div.classList.add('hidden'));
        document.getElementById(`container-${gId}`).classList.remove('hidden');
        this.nextRound();
    },

    nextRound() {
        if (this.mode === '') return;
        if (this.round >= this.maxRounds) { this.currentQIdx++; this.loadNextGameInQueue(); return; }
        this.round++;
        document.getElementById('gameTitleHint').textContent = `${getGameName(gameList.find(g=>g.id===this.queue[this.currentQIdx]))} - ${this.round}/${this.maxRounds}`;
        if (this.mode === 'challenge') {
            this.difficulty = Math.min(1 + (this.round * 0.1), 5);
            const baseT = gameList.find(g=>g.id===this.queue[this.currentQIdx]).baseTime;
            this.timeLimit = Math.max(baseT * (1 - this.round * 0.02), baseT * 0.2);
        } else { this.difficulty = 1; this.timeLimit = gameList.find(g=>g.id===this.queue[this.currentQIdx]).baseTime; }
        this.activeGame.setup(); setTimeout(() => this.startTimer(), 400);
    },

    startTimer() {
        if(this.mode === '') return;
        this.timerStart = performance.now(); this.activeGame.isActive = true;
        const tf = document.getElementById('globalTimerFill'); tf.parentElement.classList.remove('timer-danger');
        const loop = () => {
            if (!this.activeGame.isActive) return;
            const p = (performance.now() - this.timerStart) / this.timeLimit;
            if (p >= 1) { tf.style.transform = `scaleX(0)`; this.activeGame.onTimeOut(); return; }
            tf.style.transform = `scaleX(${1 - p})`;
            if (p > 0.7) tf.parentElement.classList.add('timer-danger'); else tf.parentElement.classList.remove('timer-danger');
            if (this.activeGame.onFrame) this.activeGame.onFrame(p);
            this.animFrame = requestAnimationFrame(loop);
        };
        this.animFrame = requestAnimationFrame(loop);
    },

    addScore(base, ratio) { this.score += Math.floor(base * this.difficulty * (1 + ratio)); document.getElementById('scoreDisplay').textContent = this.score; },

    getDelay(baseMs) { return this.mode === 'challenge' ? Math.max(baseMs * 0.3, 400) : baseMs; },

    roundEndDelay(ms = 1500) {
        this.activeGame.isActive = false; cancelAnimationFrame(this.animFrame); document.getElementById('globalTimerFill').style.transform = `scaleX(0)`;
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
        const canvas = document.createElement('canvas'); const scale = 3, w = 400, h = 600;
        canvas.width = w * scale; canvas.height = h * scale; const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
        
        const grad = ctx.createLinearGradient(0,0,w,h); 
        if (this.lastTarget) {
            grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, this.lastTarget.c1 + '80'); grad.addColorStop(1, this.lastTarget.c2 + '90');
        } else {
            grad.addColorStop(0, '#e0eafc'); grad.addColorStop(0.5, '#cfdef3'); grad.addColorStop(1, '#FFB6C1');
        }
        ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
        
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
        
        // 使用相容舊版的畫圓角邏輯
        drawRoundRect(ctx, 20, 20, w-40, h-40, 20);
        ctx.shadowColor = 'transparent';
        
        const rank = this.calculateRank();
        const modeName = langs[currentLang][`mode_${this.mode}`].split(' ').pop(); // 取出無 emoji 的模式名稱
        
        const texts = [
            { text: langs[currentLang].app_title, font: "bold 20px sans-serif", color: "#7F8C8D", h: 20, gap: 40 },
            { text: rank.badge, font: "60px sans-serif", color: "#000", h: 60, gap: 15 },
            { text: langs[currentLang][rank.key], font: "900 36px sans-serif", color: "#FF4081", h: 36, gap: 10, shadow: "rgba(255,64,129,0.3)" },
            { text: modeName, font: "bold 18px sans-serif", color: "#2C3E50", h: 18, gap: 15 },
            { text: this.getPlayedGamesStr(), font: "bold 12px sans-serif", color: "#7F8C8D", h: 12, gap: 40, wrapWidth: 320 },
            { text: "TOTAL SCORE", font: "bold 14px sans-serif", color: "#7F8C8D", h: 14, gap: 5 },
            { text: this.score.toString(), font: "900 48px sans-serif", color: "#2C3E50", h: 48, gap: 0 }
        ];
        drawInfoGraphicText(ctx, w/2, h/2, texts);
        document.getElementById('resultCanvasPreview').src = canvas.toDataURL('image/png');
    },

    updateResultView() {
        const rank = this.calculateRank();
        const modeName = langs[currentLang][`mode_${this.mode}`];
        document.getElementById('resBadge').textContent = rank.badge;
        document.getElementById('resTitle').textContent = langs[currentLang][rank.key];
        document.getElementById('resModeLabel').textContent = modeName;
        document.getElementById('resGamesList').textContent = this.getPlayedGamesStr();
        document.getElementById('resScoreVal').textContent = this.score;

        if (this.lastTarget) {
            const rc = document.getElementById('resultCardNode');
            rc.style.background = `linear-gradient(135deg, rgba(255,255,255,0.95), ${this.lastTarget.c1}30, ${this.lastTarget.c2}50)`;
        }
        this.generateResultCanvas();
    },

    showFinalResult() {
        if(this.mode === '') return;
        this.updateResultView();
        
        if (this.mode === 'classic') {
            document.getElementById('playerName').classList.remove('hidden');
            document.getElementById('btnShareText').textContent = langs[currentLang].btn_share_lb;
        } else {
            document.getElementById('playerName').classList.add('hidden');
            document.getElementById('btnShareText').textContent = langs[currentLang].btn_share;
        }

        document.getElementById('view-game').classList.add('hidden');
        document.getElementById('globalTimerBar').classList.add('hidden');
        document.getElementById('gameTitleHint').classList.add('hidden');
        document.getElementById('view-result').classList.remove('hidden');
        triggerConfetti();
    },

    downloadResult() {
        try {
            const link = document.createElement('a'); link.download = `AKB48_FanQuest_${this.score}.png`;
            link.href = document.getElementById('resultCanvasPreview').src; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        } catch(e) {
            document.getElementById('exportImgDisplay').src = document.getElementById('resultCanvasPreview').src;
            document.getElementById('downloadModal').classList.remove('hidden');
        }
    },

    shareToX() {
        let shareUrl = window.location.href.split('?')[0];
        if (this.mode === 'classic') {
            const name = document.getElementById('playerName').value.trim() || 'Anonymous';
            leaderboard.push({n:name, s:this.score});
            const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(leaderboard.sort((a,b)=>b.s-a.s).slice(0,10)))));
            shareUrl += '?lb=' + b64;
        }
        const rank = this.calculateRank(), title = langs[currentLang][rank.key];
        const modeName = langs[currentLang][`mode_${this.mode}`].split(' ').pop();
        let textTemplate = langs[currentLang][this.mode === 'classic' ? 'share_classic' : 'share_normal'];
        let text = textTemplate.replace('[MODE]', modeName).replace('[TITLE]', title).replace('[SCORE]', this.score).replace('[URL]', shareUrl);
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    },

    goHome() {
        this.mode = ''; clearTimeout(this.delayTimeout); cancelAnimationFrame(this.animFrame);
        if(this.activeGame) this.activeGame.isActive = false;
        document.getElementById('view-game').classList.add('hidden');
        document.getElementById('view-result').classList.add('hidden');
        document.getElementById('globalTimerBar').classList.add('hidden');
        document.getElementById('btnHome').classList.add('hidden');
        document.getElementById('gameTitleHint').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('view-dashboard').classList.remove('dashboard-blurred');
    }
};

// ==========================================
// 遊戲邏輯實作
// ==========================================
const Games = {
    mem: {
        isActive: false, pairs: 0, flipped: [], lock: false,
        setup() {
            const c = document.getElementById('container-mem'); c.innerHTML = ''; this.pairs = 0; this.flipped = []; this.lock = false;
            let m = shuffle(membersDB).slice(0, 8); let cards = shuffle([...m, ...m]);
            cards.forEach(mem => {
                const el = document.createElement('div'); el.className = 'mem-card'; el.dataset.id = mem.id;
                el.innerHTML = `<div class="mem-inner"><div class="mem-face mem-back">AKB</div><div class="mem-face mem-front"><img src="${mem.image}" crossorigin="anonymous" onerror="this.src='https://placehold.co/100x100/FFB6C1/FFF'"><div class="mem-name">${getRubyNameHTML(mem)}</div></div></div>`;
                el.onclick = () => {
                    if(!this.isActive || this.lock || el.classList.contains('flipped') || el.classList.contains('matched')) return;
                    el.classList.add('flipped'); this.flipped.push(el);
                    if(this.flipped.length===2) {
                        this.lock = true;
                        if(this.flipped[0].dataset.id === this.flipped[1].dataset.id) {
                            this.pairs++;
                            setTimeout(() => { 
                                this.flipped.forEach(f=>f.classList.add('matched')); this.flipped=[]; this.lock=false; 
                                if(this.pairs===8) { App.addScore(1000, 1-(performance.now()-App.timerStart)/App.timeLimit); triggerConfetti(); App.roundEndDelay(1500); }
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
            this.correctIds = [...opts].sort((a,b)=>a.genNum-b.genNum).map(m=>m.id);
            App.lastTarget = opts.find(m => m.id === this.correctIds[0]); // 最老前輩設為 Target
            shuffle(opts).forEach(m => {
                const el = document.createElement('div'); el.className = 'sort-card'; el.dataset.id = m.id;
                el.innerHTML = `<div class="sort-badge"></div><img src="${m.image}" crossorigin="anonymous" onerror="this.src='https://placehold.co/100x100/FFB6C1/FFF'"><div class="sort-gen">${getGenDisplay(m)}</div><div class="sort-name">${getRubyNameHTML(m)}</div>`;
                el.onclick = () => {
                    if(!this.isActive) return; el.classList.toggle('selected');
                    if(el.classList.contains('selected')) this.picks.push(m.id); else this.picks.splice(this.picks.indexOf(m.id),1);
                    c.querySelectorAll('.sort-card.selected').forEach(x=>x.querySelector('.sort-badge').textContent = this.picks.indexOf(x.dataset.id) + 1);
                    if(this.picks.length===4) {
                        this.isActive = false; 
                        if(this.picks.every((id,i)=>id===this.correctIds[i])) { 
                            c.querySelectorAll('.sort-card').forEach(x=>{x.classList.add('correct','revealed'); x.querySelector('.sort-badge').textContent=this.correctIds.indexOf(x.dataset.id)+1;});
                            App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); triggerConfetti(); App.roundEndDelay(2000); 
                        } else { 
                            c.classList.add('shake'); c.querySelectorAll('.sort-card').forEach(x=>x.classList.add('wrong')); App.score = Math.max(0, App.score-200); document.getElementById('scoreDisplay').textContent = App.score;
                            setTimeout(()=>{c.classList.remove('shake'); c.querySelectorAll('.sort-card').forEach(x=>{x.classList.remove('wrong','selected'); x.querySelector('.sort-badge').textContent='';}); this.picks=[]; this.isActive=true;}, App.getDelay(800));
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
            this.target = membersDB[Math.floor(Math.random()*membersDB.length)]; App.lastTarget = this.target;
            const hintStr = getRubyNameHTML(this.target) + (this.target.nickname ? ` (${this.target.nickname})` : "");
            document.getElementById('gameTitleHint').innerHTML = `${langs[currentLang].find_hint} <span style="color:#2196F3">${hintStr}</span>`;
            
            let pool = [this.target]; while(pool.length<20) pool.push(membersDB[Math.floor(Math.random()*membersDB.length)]);
            const rect = c.getBoundingClientRect() || {width:300, height:300}; 
            const ns = window.innerWidth > 768 ? 90 : 65; 
            
            shuffle(pool).forEach(m => {
                const el = document.createElement('div'); el.className = 'fly-node'; el.dataset.id = m.id;
                el.style.width=el.style.height=ns+'px';
                el.innerHTML = `<img src="${m.image}" crossorigin="anonymous" onerror="this.src='https://placehold.co/100x100/FFB6C1/FFF'">`; 
                let x=Math.random()*(rect.width-ns), y=Math.random()*(rect.height-ns), a=Math.random()*Math.PI*2;
                let s = (Math.random()*1.0 + 0.3) * (window.innerWidth>768 ? 0.4 : 0.8) * App.difficulty;
                el.style.transform = `translate(${x}px, ${y}px)`;
                el.onclick = (e) => {
                    e.stopPropagation(); if(!this.isActive) return; 
                    if(m.id===this.target.id) { 
                        this.isActive=false; el.classList.add('correct'); c.classList.add('dimmed'); 
                        el.style.transform = `translate(${rect.width/2 - ns/2}px, ${rect.height/2 - ns/2}px) scale(2)`;
                        el.style.boxShadow = `0 0 40px ${this.target.c1}, inset 0 0 20px ${this.target.c2}`;
                        App.addScore(1000, 1-(performance.now()-App.timerStart)/App.timeLimit); triggerConfetti(); App.roundEndDelay(2500); 
                    } else { App.score = Math.max(0, App.score-50); document.getElementById('scoreDisplay').textContent=App.score; el.style.borderColor='red'; setTimeout(()=>el.style.borderColor='#fff', 300); }
                }; c.appendChild(el); this.nodes.push({el, x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, size:ns});
            });
        }, 
        onFrame() {
            const rect = document.getElementById('container-find').getBoundingClientRect();
            this.nodes.forEach(n => { n.x+=n.vx; n.y+=n.vy; if(n.x<=0||n.x+n.size>=rect.width) n.vx*=-1; if(n.y<=0||n.y+n.size>=rect.height) n.vy*=-1; n.el.style.transform = `translate(${n.x}px, ${n.y}px)`; });
        }, 
        onTimeOut() { document.getElementById('container-find').classList.add('dimmed'); this.nodes.find(n=>n.el.dataset.id===this.target.id).el.classList.add('correct'); App.roundEndDelay(2000); }
    },
    macro: {
        isActive: false, target: null, px: 0, py: 0, zoom: 6,
        setup() {
            const img = document.getElementById('macroImg'), opts = document.getElementById('macroOpts'); opts.innerHTML = ''; img.style.transition = 'none';
            let pool = shuffle(membersDB).slice(0,4); this.target = pool[0]; pool = shuffle(pool); img.src = this.target.image; App.lastTarget = this.target;
            this.zoom = 5 + (App.difficulty * 1.5); this.px = (Math.random()*60-30); this.py = (Math.random()*60-30);
            img.style.transform = `scale(${this.zoom}) translate(${this.px}%, ${this.py}%)`;
            pool.forEach(m => {
                const b = document.createElement('button'); b.className = 'opt-btn'; b.dataset.id = m.id; b.innerHTML = getRubyNameHTML(m);
                b.onclick = () => { 
                    if(!this.isActive) return; this.isActive=false; 
                    img.style.transition = `transform ${App.getDelay(600)}ms ease`; img.style.transform='scale(1) translate(0,0)'; 
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); triggerConfetti(); } 
                    else { b.classList.add('wrong'); Array.from(opts.children).find(x=>x.dataset.id===this.target.id).classList.add('correct'); }
                    App.roundEndDelay(2500); 
                }; opts.appendChild(b);
            });
        }, 
        onFrame(p) { document.getElementById('macroImg').style.transform = `scale(${this.zoom - ((this.zoom-1)*p)}) translate(${this.px*(1-p)}%, ${this.py*(1-p)}%)`; },
        onTimeOut() { document.getElementById('macroImg').style.transition = `transform ${App.getDelay(600)}ms ease`; document.getElementById('macroImg').style.transform = 'scale(1)'; Array.from(document.getElementById('macroOpts').children).find(x=>x.dataset.id===this.target.id).classList.add('correct'); App.roundEndDelay(2000); }
    },
    duel: {
        isActive: false, setup() {
            const c = document.getElementById('container-duel'); c.innerHTML = '<div class="duel-vs">VS</div>';
            let m1 = membersDB[Math.floor(Math.random()*membersDB.length)], m2;
            do { m2 = membersDB[Math.floor(Math.random()*membersDB.length)]; } while(m1.genNum === m2.genNum);
            App.lastTarget = m1.genNum < m2.genNum ? m1 : m2;
            [m1, m2].forEach((m, i) => {
                const el = document.createElement('div'); el.className = 'duel-card'; el.id = `duel${i}`;
                el.innerHTML = `<img src="${m.image}" crossorigin="anonymous" onerror="this.src='https://placehold.co/200x300/FFB6C1/FFF'"><div class="duel-gen">${getGenDisplay(m)}</div><div class="duel-name">${getRubyNameHTML(m)}</div>`;
                el.onclick = () => {
                    if(!this.isActive) return; this.isActive=false; c.querySelectorAll('.duel-card').forEach(x=>x.classList.add('revealed')); 
                    if((i===0&&m1.genNum<m2.genNum)||(i===1&&m2.genNum<m1.genNum)) { el.classList.add('correct'); App.addScore(600, 1-(performance.now()-App.timerStart)/App.timeLimit); triggerConfetti(); }
                    else { el.classList.add('wrong'); c.style.animation='shake 0.4s'; document.getElementById(`duel${i===0?1:0}`).classList.add('correct'); }
                    App.roundEndDelay(1500);
                }; c.appendChild(el);
            });
        }, onTimeOut() { document.getElementById('container-duel').querySelectorAll('.duel-card').forEach(c=>c.classList.add('wrong', 'revealed')); App.roundEndDelay(1500); }
    },
    smile: {
        isActive: false, mx: 50, my: 50, vx: 0.5, vy: 0.5, baseMask: 65,
        setup() {
            const view = document.getElementById('smileView'), opts = document.getElementById('smileOpts'); opts.innerHTML = '';
            view.classList.remove('revealed'); let pool = shuffle(membersDB).slice(0,4); this.target = pool[0]; App.lastTarget = this.target;
            document.getElementById('smileSharp').src = this.target.image;
            this.baseMask = Math.max(50 - (App.difficulty * 5), 25);
            this.mx = 30+Math.random()*40; this.my = 30+Math.random()*40;
            this.vx = (Math.random()-0.5)*1.2; this.vy = (Math.random()-0.5)*1.2;
            document.getElementById('smileFrosted').style.transition = 'none';
            view.style.setProperty('--mask-size', `${this.baseMask}px`);

            shuffle(pool).forEach(m => {
                const b = document.createElement('button'); b.className = 'opt-btn'; b.dataset.id = m.id; b.innerHTML = getRubyNameHTML(m);
                b.onclick = () => { 
                    if(!this.isActive) return; this.isActive=false; view.classList.add('revealed'); 
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); triggerConfetti(); } 
                    else { b.classList.add('wrong'); Array.from(opts.children).find(x=>x.dataset.id===this.target.id).classList.add('correct'); }
                    App.roundEndDelay(2500); 
                }; opts.appendChild(b);
            });
        }, 
        onFrame(p) {
            this.mx += this.vx; this.my += this.vy; if(this.mx<20||this.mx>80) this.vx*=-1; if(this.my<20||this.my>80) this.vy*=-1;
            const v = document.getElementById('smileView'); v.style.setProperty('--mask-x', this.mx+'%'); v.style.setProperty('--mask-y', this.my+'%');
            v.style.setProperty('--mask-size', `${this.baseMask * (1 - (p * 0.3))}px`);
        }, 
        onTimeOut() { document.getElementById('smileView').classList.add('revealed'); Array.from(document.getElementById('smileOpts').children).find(x=>x.dataset.id===this.target.id).classList.add('correct'); App.roundEndDelay(2000); }
    },
    puz: {
        isActive: false, state: [], sel: null, target: null,
        setup() {
            const c = document.getElementById('puzGrid'); Array.from(c.children).forEach(x=>{if(x.id!=='puzOverlay') x.remove();}); 
            document.getElementById('puzOverlay').style.opacity = 0;
            this.target = membersDB[Math.floor(Math.random()*membersDB.length)]; document.getElementById('puzOverlay').src = this.target.image; this.state = []; this.sel = null;
            App.lastTarget = this.target;

            for(let i=0; i<9; i++) this.state.push({id:i, pos:i, rot:Math.floor(Math.random()*4)});
            for(let i=8; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [this.state[i].pos, this.state[j].pos] = [this.state[j].pos, this.state[i].pos]; }
            if(this.state.every(p=>p.id===p.pos && p.rot===0)) this.state[0].rot = 1; this.render();
        },
        render() {
            const c = document.getElementById('puzGrid'); Array.from(c.children).forEach(x=>{if(x.id!=='puzOverlay') x.remove();});
            for(let pos=0; pos<9; pos++) {
                const pData = this.state.find(p=>p.pos===pos); const el = document.createElement('div'); el.className = `puz-piece ${this.sel===pos?'selected':''}`;
                el.innerHTML = `<div class="puz-img" style="background-image:url(${this.target.image}); background-position:${(pData.id%3)*50}% ${Math.floor(pData.id/3)*50}%; transform:rotate(${pData.rot*90}deg)"></div>`;
                el.onclick = () => {
                    if(!this.isActive) return;
                    if(this.sel===null) { this.sel=pos; this.render(); } else if(this.sel===pos) { pData.rot=(pData.rot+1)%4; this.sel=null; this.render(); this.check(); } else { const p1 = this.state.find(p=>p.pos===this.sel); p1.pos=pos; pData.pos=this.sel; this.sel=null; this.render(); this.check(); }
                }; c.insertBefore(el, document.getElementById('puzOverlay'));
            }
        },
        check() { if(this.state.every(p=>p.id===p.pos && p.rot===0)) { this.isActive=false; document.getElementById('puzOverlay').style.opacity = 1; App.addScore(1200, 1-(performance.now()-App.timerStart)/App.timeLimit); triggerConfetti(); App.roundEndDelay(2500); } },
        onTimeOut() { document.getElementById('puzOverlay').style.opacity = 1; App.roundEndDelay(2000); }
    }
};

window.onload = loadData;
