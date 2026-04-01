let membersDB = [];
let langs = {};
let currentLang = 'zh-HK';
let leaderboard = [];

// 🌟 永久存儲數據
let userData = {
    totalScore: parseInt(localStorage.getItem('akb_total_xp')) || 0,
    unlockedIds: JSON.parse(localStorage.getItem('akb_unlocked')) || [],
    myOshiId: localStorage.getItem('akb_my_oshi') || null
};

function saveUserData() {
    localStorage.setItem('akb_total_xp', userData.totalScore);
    localStorage.setItem('akb_unlocked', JSON.stringify(userData.unlockedIds));
    localStorage.setItem('akb_my_oshi', userData.myOshiId);
}

function getLevelLabel(score) {
    if (score > 2000000) return langs[currentLang].lv_6;
    if (score > 1000000) return langs[currentLang].lv_5;
    if (score > 500000) return langs[currentLang].lv_4;
    if (score > 200000) return langs[currentLang].lv_3;
    if (score > 50000) return langs[currentLang].lv_2;
    return langs[currentLang].lv_1;
}

function getGenYear(m) {
    const name = m.name_ja;
    const gen = m.genString;
    if (name === "坂川 陽香" || name === "徳永 羚海") return 2019;
    if (gen.includes("13期")) return 2011;
    if (gen.includes("14期")) return 2012;
    if (gen.includes("15期")) return 2013;
    if (gen.includes("Team 8") || gen.includes("チーム8")) return 2014;
    if (gen.includes("D2") || gen.includes("ドラフト2")) return 2015;
    if (gen.includes("16期")) return 2016;
    if (gen.includes("D3") || gen.includes("ドラフト3")) return 2018;
    if (gen.includes("17期")) return 2022;
    if (gen.includes("18期")) return 2023;
    if (gen.includes("19期") || gen.includes("20期")) return 2024;
    if (gen.includes("21期")) return 2025;
    return "";
}

function normalizeMembers(rawList) {
    return rawList.map((m, index) => {
        let kana = m.name_kana || "";
        if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(kana)) kana = "";
        let colors = (m.colorData && m.colorData.length > 0) ? m.colorData.map(c => c.color) : ["#FF4081", "#FFB6C1"];
        
        let gStr = m.ki || m.generation || "Unknown";
        let gNum = parseFloat(m.genNum) || parseFloat(m.ki) || 99;
        if (gStr.includes("Team 8") || gStr.includes("チーム8")) gNum = 15.1;
        if (gStr.includes("ドラフト2") || gStr.includes("D2")) gNum = 15.2;
        if (gStr.includes("ドラフト3") || gStr.includes("D3")) gNum = 15.3;

        return {
            id: String(m.id || index),
            name_ja: m.name_ja || m.name,
            name_kana: kana,
            genString: gStr,
            genNum: gNum,
            nickname: m.nickname || "",
            image: m.img_url || m.image || m.img || m.photo,
            colorsArray: colors,
            imgLoaded: false
        };
    });
}

function getValidPool() { return membersDB.filter(m => m.imgLoaded); }

async function loadData() {
    try {
        const [mRes, lRes] = await Promise.all([ fetch('members.json'), fetch('langs.json') ]);
        const mRaw = await mRes.json();
        langs = await lRes.json();
        membersDB = normalizeMembers(mRaw);
        App.init();
    } catch (err) { console.error(err); }
}

const gameList = [
    { id: 'smile', baseTime: 12000 }, { id: 'duel', baseTime: 5000 }, { id: 'sort', baseTime: 15000 },
    { id: 'find', baseTime: 15000 }, { id: 'macro', baseTime: 15000 }, { id: 'mem', baseTime: 40000 },
    { id: 'puz', baseTime: 25000 }, { id: 'color', baseTime: 10000 }
];

const App = {
    mode: '', queue: [], currentQIdx: 0, round: 0, maxRounds: 5, score: 0,
    activeGame: null, animFrame: null, timerStart: 0, timeLimit: 0, difficulty: 1,
    combo: 0, lastTarget: null, lastTime: 0, isPreloaded: false,

    init() {
        detectLang();
        this.updateHeaderStats();
        document.getElementById('btnHome').onclick = () => this.goHome();
        this.startBackgroundPreloader();
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('lb')) {
            try { leaderboard = JSON.parse(decodeURIComponent(escape(atob(urlParams.get('lb'))))); this.renderLeaderboard(); } catch(e) {}
        }
    },

    updateHeaderStats() {
        document.getElementById('userLevelDisplay').textContent = `Lv.${Math.floor(userData.totalScore/10000) + 1} ${getLevelLabel(userData.totalScore)}`;
        document.getElementById('albumCountDisplay').textContent = `${userData.unlockedIds.length}/52`;
    },

    startBackgroundPreloader() {
        membersDB.forEach(m => {
            const tryLoad = () => {
                if (m.imgLoaded) return;
                const img = new Image();
                img.onload = () => { m.imgLoaded = true; this.updateHeaderStats(); };
                img.onerror = () => setTimeout(tryLoad, 4000);
                img.src = m.image;
            };
            tryLoad();
        });
    },

    showAlbum() {
        const grid = document.getElementById('albumGrid');
        grid.innerHTML = '';
        membersDB.forEach(m => {
            const isUnlocked = userData.unlockedIds.includes(m.id);
            const item = document.createElement('div');
            item.className = `album-item ${isUnlocked ? '' : 'locked'}`;
            item.innerHTML = `<img src="${m.image}"><span>${isUnlocked ? m.name_ja : '???'}</span>`;
            grid.appendChild(item);
        });
        document.getElementById('albumModal').classList.remove('hidden');
    },

    showOshiSelect() {
        const grid = document.getElementById('oshiSelectGrid');
        grid.innerHTML = '';
        const valid = getValidPool();
        if (valid.length < 12) { alert("圖片載入中，請稍候..."); return; }
        
        valid.sort((a,b) => a.genNum - b.genNum).forEach(m => {
            const item = document.createElement('div');
            item.className = `oshi-item ${userData.myOshiId === m.id ? 'selected' : ''}`;
            item.onclick = () => {
                document.querySelectorAll('.oshi-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                userData.myOshiId = m.id;
            };
            item.innerHTML = `<img src="${m.image}"><span>${m.name_ja}</span>`;
            grid.appendChild(item);
        });
        document.getElementById('oshiSelectModal').classList.remove('hidden');
    },

    confirmOshiAndStart() {
        if (!userData.myOshiId) { alert("請先選擇一位成員作為你的神推！"); return; }
        saveUserData();
        document.getElementById('oshiSelectModal').classList.add('hidden');
        this.startGameFlow();
    },

    async startGameFlow() {
        document.getElementById('view-intro').classList.add('hidden');
        document.getElementById('loading-screen').classList.remove('hidden');
        
        if (this.isPreloaded) {
            this.finishLoading(); return;
        }

        const progressEl = document.getElementById('loadingText');
        const baseText = langs[currentLang].loading || "載入中...";
        const total = membersDB.length;
        
        return new Promise(resolve => {
            let elapsed = 0;
            const checkInt = setInterval(() => {
                const loadedCount = getValidPool().length; 
                if (progressEl) progressEl.textContent = `${baseText} (${Math.floor((loadedCount / total) * 100)}%)`;
                elapsed += 200;
                
                if (loadedCount === total || (elapsed >= 4000 && loadedCount >= 12)) {
                    clearInterval(checkInt);
                    this.isPreloaded = true;
                    this.finishLoading();
                    resolve();
                } else if (elapsed >= 4000 && loadedCount < 12) {
                    if (progressEl) progressEl.textContent = `網絡緩慢，等待圖片載入... (${loadedCount}/${total})`;
                }
            }, 200);
        });
    },

    finishLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('view-dashboard').classList.add('dashboard-blurred');
        populateInstructionsModal();
        document.getElementById('instructionModal').classList.remove('hidden');
    },

    closeInstructions() {
        document.getElementById('instructionModal').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('dashboard-blurred');
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
        this.hideModal(); this.mode = mode; this.score = 0; this.combo = 0; this.currentQIdx = 0;
        document.getElementById('scoreDisplay').textContent = 0;
        this.queue = (mode === 'classic') ? ['smile', 'duel', 'sort', 'find', 'macro', 'mem', 'puz', 'color'] : ids;
        
        const bgSel = document.getElementById('bgColorSelector');
        if (bgSel) bgSel.value = 'auto';

        document.getElementById('view-dashboard').classList.add('hidden'); document.getElementById('view-game').classList.remove('hidden');
        document.getElementById('btnHome').classList.remove('hidden'); document.getElementById('globalTimerBar').classList.remove('hidden'); 
        document.getElementById('gameTitleHint').classList.remove('hidden'); document.getElementById('gameInstruction').classList.remove('hidden');
        this.loadNextGameInQueue();
    },

    loadNextGameInQueue() {
        if (this.currentQIdx >= this.queue.length || this.mode === '') { this.showFinalResult(); return; }
        const gId = this.queue[this.currentQIdx]; this.round = 0; this.activeGame = Games[gId];
        
        this.maxRounds = (this.mode === 'classic' && (gId==='mem' || gId==='puz')) ? 1 : (this.mode === 'challenge' ? 50 : 5);
        
        document.querySelectorAll('#view-game > div').forEach(div => div.classList.add('hidden'));
        document.getElementById(`container-${gId}`).classList.remove('hidden');
        
        document.getElementById('gameInstruction').textContent = langs[currentLang]['inst_' + gId] || "";
        this.nextRound();
    },

    nextRound() {
        if (this.mode === '') return;
        if (this.round >= this.maxRounds) { this.currentQIdx++; this.loadNextGameInQueue(); return; }
        this.round++;
        
        const ripple = document.getElementById('difficulty-ripple');
        if (this.round > 3 || this.mode === 'challenge') ripple.classList.remove('hidden');
        else ripple.classList.add('hidden');

        document.getElementById('gameTitleHint').textContent = `${getGameName(gameList.find(g=>g.id===this.queue[this.currentQIdx]))} - ${this.round}/${this.maxRounds}`;
        this.timeLimit = gameList.find(g=>g.id===this.queue[this.currentQIdx]).baseTime;
        if (this.mode === 'challenge') this.timeLimit *= Math.max(0.3, 1 - (this.round * 0.05));
        
        this.activeGame.setup();
        setTimeout(() => this.startTimer(), 400);
    },

    startTimer() {
        if(this.mode === '') return;
        this.timerStart = performance.now(); this.lastTime = this.timerStart; this.activeGame.isActive = true;
        const tf = document.getElementById('globalTimerFill'); tf.parentElement.classList.remove('timer-danger');
        
        const loop = () => {
            if (!this.activeGame.isActive) return;
            const now = performance.now(); const dt = now - this.lastTime; this.lastTime = now;
            const p = (now - this.timerStart) / this.timeLimit;
            if (p >= 1) { tf.style.transform = `scaleX(0)`; this.combo = 0; this.updateComboHUD(); this.activeGame.onTimeOut(); return; }
            tf.style.transform = `scaleX(${1 - p})`;
            if (p > 0.7) tf.parentElement.classList.add('timer-danger'); else tf.parentElement.classList.remove('timer-danger');
            if (this.activeGame.onFrame) this.activeGame.onFrame(p, dt);
            this.animFrame = requestAnimationFrame(loop);
        };
        this.animFrame = requestAnimationFrame(loop);
    },

    addScore(base, ratio) {
        let multiplier = 1.0;
        if (this.lastTarget && this.lastTarget.id === userData.myOshiId) {
            multiplier *= 1.5; triggerConfetti();
        }
        this.combo++; multiplier *= (1 + (this.combo * 0.05));
        this.updateComboHUD();

        let bonus = 0;
        if (ratio > 0.85) { 
            bonus = base * 0.5;
            this.showFloatingText(langs[currentLang].msg_perfect);
        }

        const finalPoints = Math.floor((base + bonus) * multiplier);
        this.score += finalPoints;
        userData.totalScore += finalPoints; 
        
        if (this.lastTarget && !userData.unlockedIds.includes(this.lastTarget.id)) {
            userData.unlockedIds.push(this.lastTarget.id);
        }
        
        saveUserData(); this.updateHeaderStats();
        document.getElementById('scoreDisplay').textContent = this.score;
    },

    updateComboHUD() {
        const el = document.getElementById('comboDisplay');
        if (this.combo > 1) {
            el.textContent = `${this.combo} ${langs[currentLang].msg_combo || 'COMBO'}`;
            el.classList.remove('hidden');
        } else { el.classList.add('hidden'); }
    },

    showFloatingText(text) {
        const div = document.createElement('div');
        div.textContent = text;
        // 移高至 20%，避免重疊選項
        div.style.cssText = "position:absolute; top:20%; left:50%; transform:translate(-50%,-50%); color:#FFD700; font-size:3rem; font-weight:900; z-index:100; pointer-events:none; text-shadow:0 0 20px #FF4081; animation: comboPop 0.8s forwards;";
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 800);
    },

    getDelay(baseMs) { return this.mode === 'challenge' ? Math.max(baseMs * 0.3, 400) : baseMs; },

    roundEndDelay(ms = 1500) {
        this.activeGame.isActive = false; cancelAnimationFrame(this.animFrame);
        this.delayTimeout = setTimeout(() => this.nextRound(), this.getDelay(ms));
    },

    showFinalResult() {
        this.generateResultCanvas();
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
        document.getElementById('gameInstruction').classList.add('hidden');
        document.getElementById('view-result').classList.remove('hidden');
        triggerConfetti();
    },

    goHome() { location.reload(); },

    calculateRank() {
        let maxPossible = this.queue.length * this.maxRounds * 2000; 
        if(this.mode === 'classic') maxPossible = (2 * 1 * 2000) + (6 * 5 * 2000); 
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
        
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
        
        const bgVal = document.getElementById('bgColorSelector') ? document.getElementById('bgColorSelector').value : 'auto';
        let targetColorMember = this.lastTarget;
        if (bgVal !== 'auto') targetColorMember = membersDB.find(m => m.id === bgVal) || this.lastTarget;

        const grad = ctx.createLinearGradient(0,0,w,h); 
        if (targetColorMember && targetColorMember.colorsArray.length > 0) {
            grad.addColorStop(0, '#ffffff'); 
            grad.addColorStop(0.5, hexToRgba(targetColorMember.colorsArray[0], 0.15)); 
            let c2 = targetColorMember.colorsArray.length > 1 ? targetColorMember.colorsArray[1] : targetColorMember.colorsArray[0];
            grad.addColorStop(1, hexToRgba(c2, 0.35));
        } else {
            grad.addColorStop(0, '#e0eafc'); grad.addColorStop(0.5, '#cfdef3'); grad.addColorStop(1, '#FFB6C1');
        }
        ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
        
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
        drawRoundRect(ctx, 20, 20, w-40, h-40, 20);
        ctx.shadowColor = 'transparent';
        
        const rank = this.calculateRank();
        const modeStr = langs[currentLang][`mode_${this.mode}`] || "";
        const modeName = modeStr.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, '').trim();
        const pName = document.getElementById('playerName') ? document.getElementById('playerName').value.trim() : '';
        const txtTotalScore = langs[currentLang].total_score || "TOTAL SCORE";
        const txtPlayerPrefix = langs[currentLang].player_prefix || "Player: ";

        const texts = [
            { text: langs[currentLang].app_title, font: "bold 20px 'Noto Sans JP', sans-serif", color: "#7F8C8D", h: 20, gap: 35 },
            { text: rank.badge, font: "60px 'Noto Sans JP', sans-serif", color: "#000", h: 60, gap: 10 },
            { text: langs[currentLang][rank.key], font: "900 36px 'Noto Sans JP', sans-serif", color: "#FF4081", h: 36, gap: 5, shadow: "rgba(255,64,129,0.3)" },
            { text: modeName, font: "bold 18px 'Noto Sans JP', sans-serif", color: "#2C3E50", h: 18, gap: pName ? 10 : 20 }
        ];

        if (pName) { texts.push({ text: `${txtPlayerPrefix}${pName}`, font: "bold 18px 'Noto Sans JP', sans-serif", color: "#4CAF50", h: 18, gap: 15 }); }
        
        texts.push(
            { text: this.getPlayedGamesStr(), font: "bold 12px 'Noto Sans JP', sans-serif", color: "#7F8C8D", h: 12, gap: 35, wrapWidth: 320 },
            { text: txtTotalScore, font: "bold 14px 'Noto Sans JP', sans-serif", color: "#7F8C8D", h: 14, gap: 5 },
            { text: this.score.toString(), font: "900 48px 'Noto Sans JP', sans-serif", color: "#2C3E50", h: 48, gap: 0 }
        );
        
        drawInfoGraphicText(ctx, w/2, h/2, texts);
        
        let previewImg = document.getElementById('resultCanvasPreview');
        if (!previewImg) {
            const wrapNode = document.getElementById('canvasWrapNode') || document.querySelector('.canvas-preview-wrap');
            if (wrapNode) {
                previewImg = document.createElement('img'); previewImg.id = 'resultCanvasPreview'; wrapNode.appendChild(previewImg);
            }
        }
        if (previewImg) previewImg.src = canvas.toDataURL('image/png');
    },

    updateResultView() { this.generateResultCanvas(); },

    downloadResult() {
        try {
            const link = document.createElement('a'); link.download = `AKB48_FanQuest_${this.score}.png`;
            link.href = document.getElementById('resultCanvasPreview').src; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        } catch(e) {
            document.getElementById('exportImgDisplay').src = document.getElementById('resultCanvasPreview').src;
            document.getElementById('downloadModal').classList.remove('hidden');
        }
    },

    copyLink() {
        let shareUrl = window.location.href.split('?')[0];
        if (this.mode === 'classic') {
            const pName = document.getElementById('playerName') ? document.getElementById('playerName').value.trim() : '';
            const name = pName || 'Anonymous';
            const tempLb = leaderboard.concat([{n:name, s:this.score}]);
            const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(tempLb.sort((a,b)=>b.s-a.s).slice(0,10)))));
            shareUrl += '?lb=' + b64;
        }
        navigator.clipboard.writeText(shareUrl).then(() => { alert(langs[currentLang].msg_copied || "Copied!"); }).catch(err => { console.error('Copy failed', err); });
    },

    shareToX() {
        let shareUrl = window.location.href.split('?')[0];
        const pName = document.getElementById('playerName') ? document.getElementById('playerName').value.trim() : '';
        if (this.mode === 'classic') {
            const name = pName || 'Anonymous';
            leaderboard.push({n:name, s:this.score});
            const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(leaderboard.sort((a,b)=>b.s-a.s).slice(0,10)))));
            shareUrl += '?lb=' + b64;
        }
        const rank = this.calculateRank(), title = langs[currentLang][rank.key];
        const modeStr = langs[currentLang][`mode_${this.mode}`] || "";
        const modeName = modeStr.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, '').trim();
        const displayName = pName ? pName : (currentLang.startsWith('en') ? "I" : "我");
        let textTemplate = langs[currentLang][this.mode === 'classic' ? 'share_classic' : 'share_normal'];
        let text = textTemplate.replace('[NAME]', displayName).replace('[MODE]', modeName).replace('[TITLE]', title).replace('[SCORE]', this.score).replace('[URL]', shareUrl);
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    }
};

// ==========================================
// 遊戲邏輯實作 (完美還原 UI 反饋)
// ==========================================
const Games = {
    mem: {
        isActive: false, pairs: 0, flipped: [], lock: false,
        setup() {
            const c = document.getElementById('container-mem'); c.innerHTML = ''; this.pairs = 0; this.flipped = []; this.lock = false;
            let valid = getValidPool(); let m = shuffle(valid).slice(0, 8); let cards = shuffle([...m, ...m]);
            cards.forEach(mem => {
                const el = document.createElement('div'); el.className = 'mem-card'; el.dataset.id = mem.id;
                // 修復：加回 Nickname
                el.innerHTML = `<div class="mem-inner"><div class="mem-face mem-back">AKB</div><div class="mem-face mem-front"><img src="${mem.image}"><div class="mem-name-wrap"><div class="mem-name">${getRubyNameHTML(mem)}</div><div class="mem-nickname">${mem.nickname}</div></div></div></div>`;
                el.onclick = () => {
                    if(!this.isActive || this.lock || el.classList.contains('flipped') || el.classList.contains('matched')) return;
                    el.classList.add('flipped'); this.flipped.push(el);
                    if(this.flipped.length===2) {
                        this.lock = true;
                        if(this.flipped[0].dataset.id === this.flipped[1].dataset.id) {
                            this.pairs++; this.flipped.forEach(f=>f.classList.add('matched'));
                            this.lastTarget = m.find(x=>x.id === this.flipped[0].dataset.id);
                            this.flipped=[]; this.lock=false;
                            if(this.pairs===8) { App.addScore(2000, 1-(performance.now()-App.timerStart)/App.timeLimit); App.roundEndDelay(1500); }
                        } else { App.combo = 0; setTimeout(() => { this.flipped.forEach(f=>f.classList.remove('flipped')); this.flipped=[]; this.lock=false; }, 800); }
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
            let pool = shuffle(getValidPool()).slice(0, 8), opts = [], used = new Set();
            for(let m of pool) { if(!used.has(m.genNum)) { opts.push(m); used.add(m.genNum); } if(opts.length===4) break; }
            this.correctIds = [...opts].sort((a,b)=>a.genNum-b.genNum).map(m=>m.id);
            App.lastTarget = opts.find(m => m.id === this.correctIds[0]);
            shuffle(opts).forEach(m => {
                const el = document.createElement('div'); el.className = 'sort-card'; el.dataset.id = m.id;
                // 修復：加回 Ruby Name
                el.innerHTML = `<div class="sort-badge"></div><img src="${m.image}"><div class="sort-gen">${getGenDisplay(m)}</div><div class="sort-name">${getRubyNameHTML(m)}</div>`;
                el.onclick = () => {
                    if(!this.isActive) return;
                    if(el.classList.contains('selected')) { this.picks.splice(this.picks.indexOf(m.id), 1); el.classList.remove('selected'); } 
                    else if(this.picks.length < 4) { this.picks.push(m.id); el.classList.add('selected'); }
                    c.querySelectorAll('.sort-card').forEach(x => {
                        const idx = this.picks.indexOf(x.dataset.id);
                        x.querySelector('.sort-badge').textContent = idx !== -1 ? idx + 1 : '';
                    });
                    if(this.picks.length===4) {
                        this.isActive = false; 
                        const isCorrect = this.picks.every((id,i)=>id===this.correctIds[i]);
                        c.querySelectorAll('.sort-card').forEach(x => {
                            x.classList.add('revealed', isCorrect ? 'correct' : 'wrong');
                            x.querySelector('.sort-badge').textContent = this.correctIds.indexOf(x.dataset.id) + 1;
                        });
                        if(isCorrect) App.addScore(1000, 1-(performance.now()-App.timerStart)/App.timeLimit);
                        else { App.combo = 0; App.score = Math.max(0, App.score-200); document.getElementById('scoreDisplay').textContent = App.score; }
                        App.roundEndDelay(2500); // 修復過度等待
                    }
                }; c.appendChild(el);
            });
        },
        onTimeOut() { 
            const c = document.getElementById('container-sort');
            c.querySelectorAll('.sort-card').forEach(x=>{
                x.classList.add('wrong', 'revealed');
                x.querySelector('.sort-badge').textContent=this.correctIds.indexOf(x.dataset.id)+1;
            });
            App.roundEndDelay(2500); 
        }
    },
    find: {
        isActive: false, nodes: [], target: null,
        setup() {
            const c = document.getElementById('container-find'); c.innerHTML = ''; c.classList.remove('dimmed'); this.nodes = [];
            const valid = getValidPool();
            this.target = valid[Math.floor(Math.random()*valid.length)]; App.lastTarget = this.target;
            // 修復：Find 標題 Ruby 與 Nickname
            const hintStr = getRubyNameHTML(this.target) + (this.target.nickname ? ` (${this.target.nickname})` : "");
            // 只有當前遊戲是 Find 才設定，避免覆蓋下一局標題
            setTimeout(() => { document.getElementById('gameTitleHint').innerHTML = `${langs[currentLang].find_hint} <span style="color:#2196F3">${hintStr}</span>`; }, 10);
            
            let pool = [this.target]; while(pool.length<15) pool.push(valid[Math.floor(Math.random()*valid.length)]);
            const rect = c.getBoundingClientRect(); const ns = 70;
            shuffle(pool).forEach(m => {
                const el = document.createElement('div'); el.className = 'fly-node'; el.dataset.id = m.id;
                el.style.width=el.style.height=ns+'px'; el.innerHTML = `<img src="${m.image}">`;
                let x=Math.random()*(rect.width-ns), y=Math.random()*(rect.height-ns), a=Math.random()*Math.PI*2;
                let s = (1.5 + Math.random()) * App.difficulty;
                el.style.transform = `translate(${x}px, ${y}px)`;
                el.onclick = (e) => {
                    e.stopPropagation(); if(!this.isActive) return; 
                    if(m.id===this.target.id) {
                        this.isActive=false; el.classList.add('correct'); c.classList.add('dimmed');
                        // 修復：點擊後放大並加推色框
                        el.style.transform = `translate(${rect.width/2 - ns/2}px, ${rect.height/2 - ns/2}px) scale(2)`;
                        let c1 = m.colorsArray[0] || '#FF4081', c2 = m.colorsArray[1] || c1;
                        el.style.boxShadow = `0 0 40px ${c1}, inset 0 0 20px ${c2}`;
                        App.addScore(1000, 1-(performance.now()-App.timerStart)/App.timeLimit); App.roundEndDelay(2500);
                    } else { App.combo = 0; el.style.borderColor='red'; setTimeout(()=>el.style.borderColor='#fff', 300); }
                }; c.appendChild(el); this.nodes.push({el, x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, size:ns});
            });
        },
        onFrame(p, dt) {
            const rect = document.getElementById('container-find').getBoundingClientRect(); const ts = dt / 16.66;
            this.nodes.forEach(n => {
                n.x+=n.vx*ts; n.y+=n.vy*ts;
                if(n.x<=0||n.x+n.size>=rect.width) n.vx*=-1; if(n.y<=0||n.y+n.size>=rect.height) n.vy*=-1;
                n.el.style.transform = `translate(${n.x}px, ${n.y}px)`;
            });
        },
        onTimeOut() { 
            document.getElementById('container-find').classList.add('dimmed'); 
            const targetNode = this.nodes.find(n=>n.el.dataset.id===this.target.id);
            if (targetNode) {
                targetNode.el.classList.add('correct');
                const rect = document.getElementById('container-find').getBoundingClientRect();
                targetNode.el.style.transform = `translate(${rect.width/2 - targetNode.size/2}px, ${rect.height/2 - targetNode.size/2}px) scale(2)`;
                let c1 = this.target.colorsArray[0] || '#FF4081', c2 = this.target.colorsArray[1] || c1;
                targetNode.el.style.boxShadow = `0 0 40px ${c1}, inset 0 0 20px ${c2}`;
            }
            App.roundEndDelay(2500); 
        }
    },
    color: {
        isActive: false, target: null,
        setup() {
            const opts = document.getElementById('colorOpts'); document.getElementById('colorDisplay').innerHTML = ''; opts.innerHTML = '';
            let valid = getValidPool(); this.target = valid[Math.floor(Math.random()*valid.length)]; App.lastTarget = this.target;
            const tColorsStr = [...this.target.colorsArray].sort().join(',');
            let validPool = valid.filter(m => m.id !== this.target.id && [...m.colorsArray].sort().join(',') !== tColorsStr);
            if(validPool.length < 3) validPool = valid.filter(m => m.id !== this.target.id);
            
            document.getElementById('colorDisplay').innerHTML = this.target.colorsArray.map(c=>`<div class="color-chunk" style="background:${c}; border:3px solid #fff; border-radius: 12px; box-shadow: inset 0 0 10px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1);"></div>`).join('');
            let pool = shuffle([this.target, ...shuffle(validPool).slice(0,3)]);
            pool.forEach(m => {
                const b = document.createElement('button'); b.className = 'opt-btn'; b.dataset.id = m.id; b.innerHTML = getRubyNameHTML(m);
                b.onclick = () => {
                    if(!this.isActive) return; this.isActive=false;
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); }
                    // 修復：Color 錯誤 UI 反饋
                    else { b.classList.add('wrong'); Array.from(opts.children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); App.combo = 0; }
                    App.roundEndDelay(2000);
                }; opts.appendChild(b);
            });
        },
        onTimeOut() { Array.from(document.getElementById('colorOpts').children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); App.roundEndDelay(2000); }
    },
    macro: {
        isActive: false, target: null, px: 0, py: 0, zoom: 6,
        setup() {
            const img = document.getElementById('macroImg'), opts = document.getElementById('macroOpts'); opts.innerHTML = ''; img.style.transition = 'none';
            let valid = getValidPool(); let pool = shuffle(valid).slice(0,4); this.target = pool[0]; pool = shuffle(pool); img.src = this.target.image; App.lastTarget = this.target;
            this.zoom = 5 + (App.difficulty * 1.5); this.px = (Math.random()*60-30); this.py = (Math.random()*60-30);
            img.style.transform = `scale(${this.zoom}) translate(${this.px}%, ${this.py}%)`;
            pool.forEach(m => {
                const b = document.createElement('button'); b.className = 'opt-btn'; b.dataset.id = m.id; b.innerHTML = getRubyNameHTML(m);
                b.onclick = () => {
                    if(!this.isActive) return; this.isActive=false;
                    img.style.transition = `transform ${App.getDelay(600)}ms ease`; img.style.transform='scale(1) translate(0,0)';
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(1000, 1-(performance.now()-App.timerStart)/App.timeLimit); }
                    // 修復：Macro 錯誤 UI 反饋
                    else { b.classList.add('wrong'); Array.from(opts.children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); App.combo = 0; }
                    App.roundEndDelay(2500);
                }; opts.appendChild(b);
            });
        },
        // 修復：掛載 onFrame 實作縮小移動
        onFrame(p) { document.getElementById('macroImg').style.transform = `scale(${this.zoom - ((this.zoom-1)*p)}) translate(${this.px*(1-p)}%, ${this.py*(1-p)}%)`; },
        onTimeOut() { 
            document.getElementById('macroImg').style.transition = `transform ${App.getDelay(600)}ms ease`; 
            document.getElementById('macroImg').style.transform = 'scale(1) translate(0,0)'; 
            Array.from(document.getElementById('macroOpts').children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); 
            App.roundEndDelay(2500); 
        }
    },
    duel: {
        isActive: false, setup() {
            const c = document.getElementById('container-duel'); c.innerHTML = '<div class="duel-vs">VS</div>';
            let valid = getValidPool(); let m1 = valid[Math.floor(Math.random()*valid.length)], m2;
            let attempts = 0; do { m2 = valid[Math.floor(Math.random()*valid.length)]; attempts++; if (attempts > 50) break; } while(m1.genNum === m2.genNum);
            App.lastTarget = m1.genNum < m2.genNum ? m1 : m2;
            [m1, m2].forEach((m, i) => {
                const el = document.createElement('div'); el.className = 'duel-card'; el.dataset.id = m.id;
                el.innerHTML = `<img src="${m.image}"><div class="duel-gen">${getGenDisplay(m)}</div><div class="duel-name">${getRubyNameHTML(m)}</div>`;
                el.onclick = () => {
                    if(!this.isActive) return; this.isActive = false;
                    const win = (i===0 && m1.genNum < m2.genNum) || (i===1 && m2.genNum < m1.genNum);
                    // 修復：Duel 正確錯誤 UI 反饋
                    c.querySelectorAll('.duel-card').forEach(x => {
                        x.classList.add('revealed');
                        if(x.dataset.id === App.lastTarget.id) x.classList.add('correct');
                        else if(x === el) x.classList.add('wrong'); // 玩家點錯的一張變紅
                    });
                    if(win) App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); else { App.combo = 0; c.style.animation='shake 0.4s'; }
                    App.roundEndDelay(2000);
                }; c.appendChild(el);
            });
        }, onTimeOut() { 
            const c = document.getElementById('container-duel');
            c.querySelectorAll('.duel-card').forEach(x => {
                x.classList.add('revealed');
                if(x.dataset.id === App.lastTarget.id) x.classList.add('correct');
                else x.classList.add('wrong');
            });
            App.roundEndDelay(2000); 
        }
    },
    smile: {
        isActive: false, mx: 50, my: 50, vx: 0.8, vy: 0.8, baseMask: 65,
        setup() {
            const view = document.getElementById('smileView'), opts = document.getElementById('smileOpts'); opts.innerHTML = '';
            view.classList.remove('revealed'); 
            let valid = getValidPool(); let pool = shuffle(valid).slice(0,4); this.target = pool[0]; App.lastTarget = this.target;
            
            // 修復：防止穿崩！先設定 Mask 為死黑色，再載入圖片
            const frosted = document.getElementById('smileFrosted');
            frosted.style.transition = 'none';
            this.baseMask = Math.max(50 - (App.difficulty * 5), 25);
            this.mx = 30+Math.random()*40; this.my = 30+Math.random()*40;
            this.vx = (Math.random()-0.5)*1.2; this.vy = (Math.random()-0.5)*1.2;
            view.style.setProperty('--mask-x', this.mx+'%'); view.style.setProperty('--mask-y', this.my+'%');
            view.style.setProperty('--mask-size', `${this.baseMask}px`);
            void view.offsetWidth; // Force Reflow
            document.getElementById('smileSharp').src = this.target.image;

            shuffle(pool).forEach(m => {
                const b = document.createElement('button'); b.className = 'opt-btn'; b.dataset.id = m.id; b.innerHTML = getRubyNameHTML(m);
                b.onclick = () => {
                    if(!this.isActive) return; this.isActive=false; view.classList.add('revealed');
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(1200, 1-(performance.now()-App.timerStart)/App.timeLimit); }
                    // 修復：Smile 錯誤 UI 反饋
                    else { b.classList.add('wrong'); Array.from(opts.children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); App.combo = 0; }
                    App.roundEndDelay(2500);
                }; opts.appendChild(b);
            });
        },
        onFrame(p, dt) {
            const ts = dt/16.66; this.mx += this.vx*ts; this.my += this.vy*ts;
            if(this.mx<20||this.mx>80) this.vx*=-1; if(this.my<20||this.my>80) this.vy*=-1;
            const v = document.getElementById('smileView');
            v.style.setProperty('--mask-x', this.mx+'%'); v.style.setProperty('--mask-y', this.my+'%');
            v.style.setProperty('--mask-size', `${this.baseMask * (1 - (p * 0.3))}px`);
        },
        onTimeOut() { document.getElementById('smileView').classList.add('revealed'); Array.from(document.getElementById('smileOpts').children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); App.roundEndDelay(2500); }
    },
    puz: {
        isActive: false, state: [], sel: null, target: null,
        setup() {
            const c = document.getElementById('puzGrid'); Array.from(c.children).forEach(x=>{if(x.id!=='puzOverlay') x.remove();});
            document.getElementById('puzOverlay').style.opacity = 0;
            this.target = getValidPool()[Math.floor(Math.random()*getValidPool().length)];
            App.lastTarget = this.target; document.getElementById('puzOverlay').src = this.target.image;
            this.state = []; this.sel = null;
            for(let i=0; i<9; i++) this.state.push({id:i, pos:i, rot:Math.floor(Math.random()*4)});
            for(let i=8; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [this.state[i].pos, this.state[j].pos] = [this.state[j].pos, this.state[i].pos]; }
            if(this.state.every(p=>p.id===p.pos && p.rot===0)) this.state[0].rot = 1; this.render();
        },
        render() {
            const c = document.getElementById('puzGrid'); Array.from(c.children).forEach(x=>{if(x.id!=='puzOverlay') x.remove();});
            for(let pos=0; pos<9; pos++) {
                const pData = this.state.find(p=>p.pos===pos); const el = document.createElement('div');
                el.className = `puz-piece ${this.sel===pos?'selected':''}`;
                el.innerHTML = `<div class="puz-img" style="background-image:url(${this.target.image}); background-position:${(pData.id%3)*50}% ${Math.floor(pData.id/3)*50}%; transform:rotate(${pData.rot*90}deg)"></div>`;
                el.onclick = () => {
                    if(!this.isActive) return;
                    if(this.sel===null) { this.sel=pos; this.render(); }
                    else if(this.sel===pos) { pData.rot=(pData.rot+1)%4; this.sel=null; this.render(); this.check(); }
                    else { const p1 = this.state.find(p=>p.pos===this.sel); p1.pos=pos; pData.pos=this.sel; this.sel=null; this.render(); this.check(); }
                }; c.insertBefore(el, document.getElementById('puzOverlay'));
            }
        },
        check() {
            if(this.state.every(p=>p.id===p.pos && p.rot===0)) {
                this.isActive=false; document.getElementById('puzOverlay').style.opacity = 1;
                App.addScore(2500, 1-(performance.now()-App.timerStart)/App.timeLimit); App.roundEndDelay(3000);
            }
        },
        onTimeOut() { document.getElementById('puzOverlay').style.opacity = 1; App.roundEndDelay(2500); }
    }
};

window.onload = loadData;

// --- 工具函數 ---
function detectLang() {
    const nav = navigator.language.toLowerCase();
    if (nav.includes('tw')) currentLang = 'zh-TW';
    else if (nav.includes('ja')) currentLang = 'ja';
    else if (nav.includes('en')) currentLang = 'en';
    else currentLang = 'zh-HK';
    document.getElementById('langSelector').value = currentLang;
    applyLang();
}
function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (langs[currentLang] && langs[currentLang][key]) el.textContent = langs[currentLang][key];
    });
    
    // 修復：實時更新正在進行中遊戲的翻譯標籤
    if (App.mode !== '') {
        const currentGameId = App.queue[App.currentQIdx];
        if (currentGameId) {
            const gameObj = gameList.find(g => g.id === currentGameId);
            if (gameObj && document.getElementById('gameTitleHint')) {
                document.getElementById('gameTitleHint').textContent = `${getGameName(gameObj)} - ${App.round}/${App.maxRounds}`;
                document.getElementById('gameInstruction').textContent = langs[currentLang]['inst_' + currentGameId] || "";
            }
        }
        
        // 即時重繪 DOM 的選項名稱
        document.querySelectorAll('.sort-name, .duel-name').forEach(el => {
            const id = el.parentElement.dataset.id; const m = membersDB.find(mem => mem.id === id); if (m) el.innerHTML = getRubyNameHTML(m);
        });
        document.querySelectorAll('.opt-btn').forEach(el => {
            const id = el.dataset.id; const m = membersDB.find(mem => mem.id === id); if (m) el.innerHTML = getRubyNameHTML(m);
        });
        document.querySelectorAll('.mem-name').forEach(el => {
            const id = el.closest('.mem-card').dataset.id; const m = membersDB.find(mem => mem.id === id); if (m) el.innerHTML = getRubyNameHTML(m);
        });
        if (App.activeGame === Games.find && App.lastTarget) {
            const hintStr = getRubyNameHTML(App.lastTarget) + (App.lastTarget.nickname ? ` (${App.lastTarget.nickname})` : "");
            document.getElementById('gameTitleHint').innerHTML = `${langs[currentLang].find_hint} <span style="color:#2196F3">${hintStr}</span>`;
        }
    }
    
    App.updateHeaderStats();
    populateInstructionsModal();
    populateMemberSelector();
}
function getDisplayName(m) {
    if (['zh-HK', 'zh-TW', 'zh-CN', 'ja'].includes(currentLang)) return m.name_ja;
    if (currentLang === 'ko') return m.name_ko;
    if (currentLang === 'th') return m.name_th;
    return m.name_en; 
}
function getRubyNameHTML(m) {
    if (['zh-HK', 'zh-TW', 'zh-CN', 'ja'].includes(currentLang) && m.name_kana) return `<ruby>${m.name_ja}<rt>${m.name_kana}</rt></ruby>`;
    return getDisplayName(m);
}
function getGameName(g) { return langs[currentLang]['gn_'+g.id]; }
function getShortName(g) { return langs[currentLang]['gs_'+g.id]; }
function shuffle(arr) { let a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function triggerConfetti() { confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 9999 }); }
function hexToRgba(hex, a) {
    let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
}
function populateInstructionsModal() {
    const list = document.getElementById('allInstructionsList'); list.innerHTML = '';
    gameList.forEach(g => { list.innerHTML += `<div style="margin-bottom:12px;"><b>[${langs[currentLang]['gn_'+g.id]}]</b><br><span style="color:var(--text-sec); font-size:0.8rem;">${langs[currentLang]['inst_'+g.id]}</span></div>`; });
}
