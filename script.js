let membersDB = [];
let langs = {};
let currentLang = 'zh-HK';
let leaderboard = [];

const SUPABASE_URL = "https://jappifgnjssqxvjodgiv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oXfJyHkRtn1BHBw-9ictBQ__01qBCZg";
const GAME_PROGRESS_STORAGE_KEY = "akb_game_progress";
const CLOUD_GAME_SLUG_GLOBAL = "fan_quest_global";

function readStoredJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
        console.warn(`Failed to parse localStorage key: ${key}`, err);
        return fallback;
    }
}

function uniqueIds(ids) {
    return [...new Set((Array.isArray(ids) ? ids : []).map(id => String(id)).filter(Boolean))];
}

function normalizeGameProgress(progress = {}) {
    return {
        version: 1,
        totalSessions: Number(progress.totalSessions) || 0,
        lastPlayedAt: progress.lastPlayedAt || null,
        lastMode: progress.lastMode || null,
        lastScore: Number(progress.lastScore) || 0,
        modes: progress.modes && typeof progress.modes === "object" ? progress.modes : {},
        games: progress.games && typeof progress.games === "object" ? progress.games : {}
    };
}

function getCurrentLevel(score = userData.totalScore) {
    return Math.floor((Number(score) || 0) / 10000) + 1;
}

// 🌟 RPG 數據存儲
let userData = {
    totalScore: parseInt(localStorage.getItem('akb_total_xp')) || 0,
    unlockedIds: uniqueIds(readStoredJson('akb_unlocked', [])),
    myOshiId: localStorage.getItem('akb_my_oshi') || null,
    gameProgress: normalizeGameProgress(readStoredJson(GAME_PROGRESS_STORAGE_KEY, {}))
};

function saveUserData(options = {}) {
    // 確保存入時剔除重複及 null 數據
    userData.unlockedIds = uniqueIds(userData.unlockedIds);
    userData.gameProgress = normalizeGameProgress(userData.gameProgress);
    localStorage.setItem('akb_total_xp', userData.totalScore);
    localStorage.setItem('akb_unlocked', JSON.stringify(userData.unlockedIds));
    localStorage.setItem('akb_my_oshi', userData.myOshiId);
    localStorage.setItem(GAME_PROGRESS_STORAGE_KEY, JSON.stringify(userData.gameProgress));
    if (!options.skipCloud) scheduleCloudSave("local_change");
}

function getLevelLabel(score) {
    const lang = langs[currentLang] || {};
    if (score > 2000000) return lang.lv_6 || "傳奇";
    if (score > 1000000) return lang.lv_5 || "神 7";
    if (score > 500000) return lang.lv_4 || "選拔";
    if (score > 200000) return lang.lv_3 || "正規";
    if (score > 50000) return lang.lv_2 || "候補";
    return lang.lv_1 || "研究生";
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
    if (gen.includes("D3") || gen.includes("ドラフト3")) return 2018; // 🌟 修正：D3 為 2018 年
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

        let colors = [];
        if (m.colorData && m.colorData.length > 0) {
            colors = m.colorData.map(c => c.color);
        } else {
            colors = ["#FF4081", "#FFB6C1"];
        }
        
        let gStr = m.ki || m.generation || "Unknown";
        let gNum = parseFloat(m.genNum) || parseFloat(m.ki) || 99;
        
        // 🌟 修正：確保期數排序邏輯完全符合加入順序
        if (gStr.includes("Team 8") || gStr.includes("チーム8")) {
            if (m.name_ja === "坂川 陽香" || m.name_ja === "徳永 羚海") {
                gNum = 16.5; // 2019加入，排喺 D3(16.1) 之後，17期(17.0) 之前
            } else {
                gNum = 15.1; // 原 Team 8，2014加入
            }
        }
        if (gStr.includes("ドラフト2") || gStr.includes("D2")) gNum = 15.2; // 2015加入
        if (gStr.includes("ドラフト3") || gStr.includes("D3")) gNum = 16.1; // 🌟 修正：2018加入，排喺 16期(16.0) 之後

        return {
            id: String(m.id || index),
            name_ja: m.name_ja || m.name || "Unknown",
            name_kana: kana,
            name_zh: m.name_zh_tw || m.name_zh_hk || m.name_zh_cn || m.name_zh || m.name_ja || "Unknown",
            name_en: m.name_en || m.name_romaji || m.name_ja || "Unknown",
            name_ko: m.name_ko || m.name_ja || "Unknown",
            name_th: m.name_th || m.name_en || m.name_ja || "Unknown",
            nickname: m.nickname || "",
            genString: gStr,
            genNum: gNum,
            image: m.img_url || m.image || m.img || m.photo,
            colorsArray: colors,
            active: m.active,
            selectable: m.selectable,
            hiddenFromSelection: m.hiddenFromSelection,
            imgLoaded: false 
        };
    });
}

function isSelectableMember(member) {
    return Boolean(member) && member.active !== false && member.selectable !== false && member.hiddenFromSelection !== true;
}

function getValidPool() { return membersDB.filter(m => m.imgLoaded && isSelectableMember(m)); }

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
    { id: 'smile', baseTime: 12000 }, { id: 'duel', baseTime: 5000 }, { id: 'sort', baseTime: 15000 },
    { id: 'find', baseTime: 15000 }, { id: 'macro', baseTime: 15000 }, { id: 'mem', baseTime: 40000 },
    { id: 'puz', baseTime: 25000 }, { id: 'color', baseTime: 10000 }
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

function populateMemberSelector() {
    const bgSel = document.getElementById('bgColorSelector');
    if (!bgSel || membersDB.length === 0) return;
    const currentVal = bgSel.value;
    
    bgSel.innerHTML = `<option value="auto" data-i18n="bg_auto">${langs[currentLang].bg_auto || '✨ 專屬應援色 (Auto)'}</option>`;
    membersDB.filter(isSelectableMember).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `🎨 ${getDisplayName(m)}`;
        bgSel.appendChild(opt);
    });
    bgSel.value = currentVal; 
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
    
    if (App.mode !== '') {
        const currentGameId = App.queue[App.currentQIdx];
        if (currentGameId) {
            const gameObj = gameList.find(g => g.id === currentGameId);
            if (gameObj && document.getElementById('gameTitleHint')) {
                document.getElementById('gameTitleHint').textContent = `${getGameName(gameObj)} - ${App.round}/${App.maxRounds}`;
                document.getElementById('gameInstruction').textContent = langs[currentLang]['inst_' + currentGameId] || "";
            }
        }
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

    const resultView = document.getElementById('view-result');
    if (resultView && !resultView.classList.contains('hidden')) {
        setTimeout(() => {
            App.generateResultCanvas(); 
            const shareBtn = document.getElementById('btnShareText');
            if (shareBtn) shareBtn.textContent = (App.mode === 'classic') ? langs[currentLang].btn_share_lb : langs[currentLang].btn_share;
        }, 10);
    }

    updateCloudUI();
}

function populateInstructionsModal() {
    const list = document.getElementById('allInstructionsList');
    if (!list) return;
    list.innerHTML = '';
    gameList.forEach(g => {
        const name = langs[currentLang]['gn_' + g.id] || g.id;
        const inst = langs[currentLang]['inst_' + g.id] || "";
        list.innerHTML += `<div style="margin-bottom: 10px;"><b>[${name}]</b><br><span style="color:var(--text-sec);">${inst}</span></div>`;
    });
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

function getGenDisplay(member) { 
    const year = getGenYear(member);
    return year ? `${member.genString} (${year})` : member.genString;
}

function t(key, replacements = {}) {
    const lang = langs[currentLang] || langs.en || {};
    const fallback = langs.en || {};
    let text = lang[key] || fallback[key] || key;
    Object.entries(replacements).forEach(([name, value]) => {
        text = text.split(`{${name}}`).join(value ?? "");
    });
    return text;
}

const cloud = {
    client: null,
    user: null,
    ready: false,
    busy: false,
    eventsBound: false,
    syncEnabled: false,
    saveTimer: null,
    statusKey: "cloud_local_only",
    messageKey: "cloud_login_hint",
    messageVars: {},
    profile: null,
    progressRows: [],
    dexRows: [],
    dexFkWarning: false,
    cloudSnapshot: null
};

function getCloudDisplayName() {
    return cloud.user?.user_metadata?.display_name || cloud.user?.email || "Tool48 Account";
}

function setCloudBusy(isBusy) {
    cloud.busy = isBusy;
    updateCloudUI();
}

function setCloudMessageKey(key, vars = {}) {
    cloud.messageKey = key;
    cloud.messageVars = { ...vars };
    renderCloudMessage();
}

function renderCloudMessage() {
    const message = document.getElementById("cloudMessage");
    if (message) message.textContent = t(cloud.messageKey, cloud.messageVars);
}

function updateCloudUI(statusKey = "") {
    if (statusKey) cloud.statusKey = statusKey;
    const loggedIn = Boolean(cloud.user);
    const status = document.getElementById("cloudStatus");
    const toggle = document.getElementById("accountToggleBtn");
    const label = toggle?.querySelector(".account-toggle-label");
    const form = document.getElementById("cloudLoginForm");
    const actions = document.getElementById("cloudActions");
    const userLabel = document.getElementById("cloudUserLabel");

    if (status) {
        const key = cloud.ready ? cloud.statusKey : "cloud_unavailable";
        status.textContent = t(key);
    }
    if (label) label.textContent = loggedIn ? getCloudDisplayName() : t("account_nav_guest");
    if (toggle) toggle.title = loggedIn ? getCloudDisplayName() : t("account_nav_guest");
    if (form) form.hidden = loggedIn || !cloud.ready;
    if (actions) actions.hidden = !loggedIn || !cloud.ready;
    if (userLabel) userLabel.textContent = loggedIn ? t("cloud_logged_in_as", { name: getCloudDisplayName() }) : "";

    ["cloudNicknameInput", "cloudEmailInput", "cloudPasswordInput", "cloudSignInBtn", "cloudSignUpBtn"].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.disabled = cloud.busy || loggedIn || !cloud.ready;
    });
    ["cloudLogoutBtn"].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.disabled = cloud.busy || !loggedIn || !cloud.ready;
    });
    renderCloudMessage();
}

function hasLocalProgress() {
    const progress = normalizeGameProgress(userData.gameProgress);
    return Boolean(
        Number(userData.totalScore) > 0 ||
        uniqueIds(userData.unlockedIds).length > 0 ||
        userData.myOshiId ||
        progress.totalSessions > 0
    );
}

function hasSnapshotProgress(snapshot) {
    if (!snapshot) return false;
    const progress = normalizeGameProgress(snapshot.gameProgress);
    return Boolean(
        Number(snapshot.xp ?? snapshot.totalScore) > 0 ||
        uniqueIds(snapshot.unlockedIds).length > 0 ||
        snapshot.myOshiId ||
        progress.totalSessions > 0
    );
}

function sortObject(value) {
    if (Array.isArray(value)) return value.map(sortObject);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((sorted, key) => {
        sorted[key] = sortObject(value[key]);
        return sorted;
    }, {});
}

function comparableSnapshot(snapshot) {
    if (!snapshot) return null;
    return {
        xp: Number(snapshot.xp ?? snapshot.totalScore) || 0,
        myOshiId: snapshot.myOshiId || null,
        unlockedIds: uniqueIds(snapshot.unlockedIds).sort(),
        gameProgress: sortObject(normalizeGameProgress(snapshot.gameProgress))
    };
}

function snapshotsDiffer(a, b) {
    return JSON.stringify(comparableSnapshot(a)) !== JSON.stringify(comparableSnapshot(b));
}

function buildMemberCardData(member, fallbackId) {
    return {
        member_id: String(member?.id || fallbackId),
        name_ja: member?.name_ja || "",
        name_en: member?.name_en || "",
        nickname: member?.nickname || "",
        generation: member?.genString || "",
        image: member?.image || "",
        colors: member?.colorsArray || []
    };
}

function buildMemberDexSnapshot() {
    const now = new Date().toISOString();
    return uniqueIds(userData.unlockedIds).map(memberId => {
        const member = membersDB.find(m => String(m.id) === String(memberId));
        return {
            member_id: String(memberId),
            unlocked_at: now,
            card_data: buildMemberCardData(member, memberId)
        };
    });
}

function buildFanQuestSnapshot() {
    const xp = Number(userData.totalScore) || 0;
    const unlockedIds = uniqueIds(userData.unlockedIds);
    return {
        version: 1,
        app: "akb_mini_games_2026",
        savedAt: new Date().toISOString(),
        level: getCurrentLevel(xp),
        xp,
        totalScore: xp,
        title: getLevelLabel(xp),
        myOshiId: userData.myOshiId || null,
        unlockedIds,
        achievements: [],
        gameProgress: normalizeGameProgress(userData.gameProgress),
        memberDex: buildMemberDexSnapshot()
    };
}

function buildProgressPayloads(snapshot) {
    const progress = normalizeGameProgress(snapshot.gameProgress);
    const rows = [{
        game_slug: CLOUD_GAME_SLUG_GLOBAL,
        progress_data: {
            app: snapshot.app,
            savedAt: snapshot.savedAt,
            level: snapshot.level,
            xp: snapshot.xp,
            title: snapshot.title,
            myOshiId: snapshot.myOshiId,
            unlockedIds: snapshot.unlockedIds,
            gameProgress: progress
        }
    }];

    Object.entries(progress.modes || {}).forEach(([mode, data]) => {
        rows.push({
            game_slug: `mode_${mode}`,
            progress_data: { savedAt: snapshot.savedAt, mode, modeData: data }
        });
    });
    Object.entries(progress.games || {}).forEach(([gameId, data]) => {
        rows.push({
            game_slug: `game_${gameId}`,
            progress_data: { savedAt: snapshot.savedAt, gameId, gameData: data }
        });
    });
    return rows;
}

function cloudRowsToSnapshot(profile, progressRows = [], dexRows = []) {
    const profileData = profile?.profile_data && typeof profile.profile_data === "object" ? profile.profile_data : {};
    const globalRow = progressRows.find(row => row.game_slug === CLOUD_GAME_SLUG_GLOBAL);
    const globalData = globalRow?.progress_data && typeof globalRow.progress_data === "object" ? globalRow.progress_data : {};
    let gameProgress = normalizeGameProgress(profileData.gameProgress || globalData.gameProgress || globalData);

    progressRows.forEach(row => {
        const data = row.progress_data && typeof row.progress_data === "object" ? row.progress_data : {};
        if (row.game_slug?.startsWith("mode_")) {
            gameProgress.modes[row.game_slug.replace("mode_", "")] = data.modeData || data;
        }
        if (row.game_slug?.startsWith("game_")) {
            gameProgress.games[row.game_slug.replace("game_", "")] = data.gameData || data;
        }
    });

    const profileDex = Array.isArray(profileData.memberDex) ? profileData.memberDex : [];
    const dexIds = dexRows.map(row => row.member_id);
    const unlockedIds = uniqueIds([...(profileData.unlockedIds || []), ...dexIds]);
    const memberDex = unlockedIds.map(memberId => {
        const dexRow = dexRows.find(row => String(row.member_id) === String(memberId));
        const profileEntry = profileDex.find(entry => String(entry.member_id) === String(memberId));
        const member = membersDB.find(m => String(m.id) === String(memberId));
        return {
            member_id: String(memberId),
            unlocked_at: dexRow?.unlocked_at || profileEntry?.unlocked_at || profileData.savedAt || new Date().toISOString(),
            card_data: dexRow?.card_data || profileEntry?.card_data || buildMemberCardData(member, memberId)
        };
    });

    const xp = Number(profile?.xp ?? profileData.xp ?? profileData.totalScore ?? globalData.xp) || 0;
    return {
        version: 1,
        app: profileData.app || "akb_mini_games_2026",
        savedAt: profile?.updated_at || profileData.savedAt || globalData.savedAt || null,
        level: Number(profile?.level ?? profileData.level ?? globalData.level) || getCurrentLevel(xp),
        xp,
        totalScore: xp,
        title: profile?.title || profileData.title || globalData.title || getLevelLabel(xp),
        myOshiId: profileData.myOshiId || globalData.myOshiId || null,
        unlockedIds,
        achievements: Array.isArray(profileData.achievements) ? profileData.achievements : [],
        gameProgress,
        memberDex
    };
}

function applyFanQuestSnapshot(snapshot) {
    if (!snapshot) return;
    const xp = Number(snapshot.xp ?? snapshot.totalScore) || 0;
    userData.totalScore = xp;
    userData.unlockedIds = uniqueIds(snapshot.unlockedIds || snapshot.memberDex?.map(entry => entry.member_id));
    userData.myOshiId = snapshot.myOshiId || null;
    userData.gameProgress = normalizeGameProgress(snapshot.gameProgress);
    saveUserData({ skipCloud: true });
    App.updateHeaderStats();
    const albumModal = document.getElementById("albumModal");
    if (albumModal && !albumModal.classList.contains("hidden")) App.showAlbum();
}

function latestTimestamp(...values) {
    return values
        .filter(Boolean)
        .map(value => new Date(value).getTime())
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0] || 0;
}

function mergeProgressEntry(localEntry = {}, cloudEntry = {}) {
    const localTime = latestTimestamp(localEntry.lastPlayedAt);
    const cloudTime = latestTimestamp(cloudEntry.lastPlayedAt);
    const latest = localTime >= cloudTime ? localEntry : cloudEntry;
    return {
        ...cloudEntry,
        ...localEntry,
        ...latest,
        playCount: Math.max(Number(localEntry.playCount) || 0, Number(cloudEntry.playCount) || 0),
        highScore: Math.max(Number(localEntry.highScore) || 0, Number(cloudEntry.highScore) || 0),
        lastScore: Number(latest.lastScore) || Math.max(Number(localEntry.lastScore) || 0, Number(cloudEntry.lastScore) || 0),
        games: uniqueIds([...(cloudEntry.games || []), ...(localEntry.games || [])])
    };
}

function mergeGameProgress(localProgress = {}, cloudProgress = {}) {
    const local = normalizeGameProgress(localProgress);
    const remote = normalizeGameProgress(cloudProgress);
    const localTime = latestTimestamp(local.lastPlayedAt);
    const remoteTime = latestTimestamp(remote.lastPlayedAt);
    const latest = localTime >= remoteTime ? local : remote;
    const modes = {};
    const games = {};

    uniqueIds([...Object.keys(remote.modes || {}), ...Object.keys(local.modes || {})]).forEach(mode => {
        modes[mode] = mergeProgressEntry(local.modes[mode], remote.modes[mode]);
    });
    uniqueIds([...Object.keys(remote.games || {}), ...Object.keys(local.games || {})]).forEach(gameId => {
        games[gameId] = mergeProgressEntry(local.games[gameId], remote.games[gameId]);
    });

    return {
        version: 1,
        totalSessions: Math.max(Number(local.totalSessions) || 0, Number(remote.totalSessions) || 0),
        lastPlayedAt: latest.lastPlayedAt || local.lastPlayedAt || remote.lastPlayedAt || null,
        lastMode: latest.lastMode || local.lastMode || remote.lastMode || null,
        lastScore: Number(latest.lastScore) || Math.max(Number(local.lastScore) || 0, Number(remote.lastScore) || 0),
        modes,
        games
    };
}

function mergeFanQuestSnapshots(localSnapshot, cloudSnapshot) {
    if (!cloudSnapshot) return localSnapshot;
    if (!localSnapshot) return cloudSnapshot;

    const localXp = Number(localSnapshot.xp ?? localSnapshot.totalScore) || 0;
    const cloudXp = Number(cloudSnapshot.xp ?? cloudSnapshot.totalScore) || 0;
    const xp = Math.max(localXp, cloudXp);
    const unlockedIds = uniqueIds([...(cloudSnapshot.unlockedIds || []), ...(localSnapshot.unlockedIds || [])]);
    const memberDexMap = new Map();
    [...(cloudSnapshot.memberDex || []), ...(localSnapshot.memberDex || [])].forEach(entry => {
        if (!entry?.member_id) return;
        const key = String(entry.member_id);
        const existing = memberDexMap.get(key);
        if (!existing || latestTimestamp(entry.unlocked_at) >= latestTimestamp(existing.unlocked_at)) {
            memberDexMap.set(key, entry);
        }
    });

    const savedAt = new Date().toISOString();
    return {
        ...cloudSnapshot,
        ...localSnapshot,
        savedAt,
        level: getCurrentLevel(xp),
        xp,
        totalScore: xp,
        title: getLevelLabel(xp),
        myOshiId: localSnapshot.myOshiId || cloudSnapshot.myOshiId || null,
        unlockedIds,
        achievements: uniqueIds([...(cloudSnapshot.achievements || []), ...(localSnapshot.achievements || [])]),
        gameProgress: mergeGameProgress(localSnapshot.gameProgress, cloudSnapshot.gameProgress),
        memberDex: unlockedIds.map(memberId => {
            const existing = memberDexMap.get(String(memberId));
            if (existing) return existing;
            const member = membersDB.find(m => String(m.id) === String(memberId));
            return {
                member_id: String(memberId),
                unlocked_at: savedAt,
                card_data: buildMemberCardData(member, memberId)
            };
        })
    };
}

function isMemberDexForeignKeyError(err) {
    return err?.code === "23503" && String(err.message || "").includes("fan_quest_member_dex");
}

function scheduleCloudSave(reason = "local_change") {
    if (!cloud.ready || !cloud.user || !cloud.syncEnabled) return;
    clearTimeout(cloud.saveTimer);
    updateCloudUI("cloud_unsaved_changes");
    cloud.saveTimer = setTimeout(() => {
        saveCloudSnapshot({ silent: true, force: true, reason }).catch(err => {
            console.warn("Cloud autosave failed", err);
        });
    }, 4000);
}

function requireCloudUser() {
    if (cloud.ready && cloud.user && cloud.client) return true;
    updateCloudUI("cloud_local_only");
    setCloudMessageKey("cloud_login_required");
    return false;
}

async function initCloudSave() {
    bindCloudEvents();
    updateCloudUI("cloud_local_only");
    if (!window.supabase?.createClient) {
        cloud.ready = false;
        setCloudMessageKey("cloud_unavailable");
        updateCloudUI("cloud_unavailable");
        return;
    }

    try {
        cloud.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        cloud.ready = true;
        const { data, error } = await cloud.client.auth.getSession();
        if (error) throw error;
        cloud.user = data.session?.user || null;
        cloud.client.auth.onAuthStateChange(async (event, session) => {
            cloud.user = session?.user || null;
            cloud.syncEnabled = false;
            cloud.cloudSnapshot = null;
            if (!cloud.user) {
                setCloudMessageKey(event === "SIGNED_OUT" ? "cloud_logged_out" : "cloud_login_hint");
                updateCloudUI("cloud_local_only");
                return;
            }
            setCloudMessageKey("cloud_signed_in");
            updateCloudUI("cloud_save_available");
            await loadCloudSnapshot({ silent: true });
        });
        if (cloud.user) {
            await loadCloudSnapshot({ silent: true });
        } else {
            setCloudMessageKey("cloud_login_hint");
            updateCloudUI("cloud_local_only");
        }
    } catch (err) {
        console.warn("Cloud Save init failed", err);
        cloud.ready = false;
        setCloudMessageKey("cloud_unavailable");
        updateCloudUI("cloud_unavailable");
    }
}

function bindCloudEvents() {
    if (cloud.eventsBound) return;
    cloud.eventsBound = true;
    const popover = document.getElementById("accountPopover");
    const toggle = document.getElementById("accountToggleBtn");

    toggle?.addEventListener("click", event => {
        event.stopPropagation();
        if (!popover || !toggle) return;
        const isOpen = !popover.hidden;
        popover.hidden = isOpen;
        toggle.setAttribute("aria-expanded", String(!isOpen));
    });
    document.getElementById("cloudCloseBtn")?.addEventListener("click", () => {
        if (popover) popover.hidden = true;
        toggle?.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("click", event => {
        if (!popover || popover.hidden) return;
        if (popover.contains(event.target) || toggle?.contains(event.target)) return;
        popover.hidden = true;
        toggle?.setAttribute("aria-expanded", "false");
    });

    document.getElementById("cloudLoginForm")?.addEventListener("submit", loginCloudAccount);
    document.getElementById("cloudLogoutBtn")?.addEventListener("click", logoutCloudAccount);
}

async function loginCloudAccount(event) {
    event.preventDefault();
    if (!cloud.client) {
        setCloudMessageKey("cloud_unavailable");
        updateCloudUI("cloud_unavailable");
        return;
    }

    const action = event.submitter?.dataset.authAction === "signup" ? "signup" : "signin";
    const nickname = document.getElementById("cloudNicknameInput")?.value.trim() || "";
    const email = document.getElementById("cloudEmailInput")?.value.trim() || "";
    const password = document.getElementById("cloudPasswordInput")?.value || "";

    if (!email || !password) {
        setCloudMessageKey("cloud_missing_email_password");
        return;
    }
    if (action === "signup" && !nickname) {
        setCloudMessageKey("cloud_missing_signup");
        return;
    }

    setCloudBusy(true);
    setCloudMessageKey(action === "signup" ? "cloud_signing_up" : "cloud_signing_in");
    try {
        const result = action === "signup"
            ? await cloud.client.auth.signUp({
                email,
                password,
                options: { data: { display_name: nickname } }
            })
            : await cloud.client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        cloud.user = result.data.session?.user || cloud.user;
        setCloudMessageKey(cloud.user ? "cloud_signed_in" : "cloud_signup_needs_confirm");
        updateCloudUI(cloud.user ? "cloud_save_available" : "cloud_local_only");
        if (cloud.user) {
            document.getElementById("accountPopover").hidden = true;
            document.getElementById("accountToggleBtn")?.setAttribute("aria-expanded", "false");
            await loadCloudSnapshot({ silent: true });
        }
    } catch (err) {
        console.warn("Account action failed", err);
        setCloudMessageKey("cloud_action_failed", { message: err.message || "" });
        updateCloudUI("cloud_save_failed_local_kept");
    } finally {
        setCloudBusy(false);
    }
}

async function logoutCloudAccount() {
    if (!cloud.client) return;
    setCloudBusy(true);
    try {
        await cloud.client.auth.signOut();
        cloud.user = null;
        cloud.syncEnabled = false;
        cloud.cloudSnapshot = null;
        setCloudMessageKey("cloud_logged_out");
        updateCloudUI("cloud_local_only");
    } catch (err) {
        console.warn("Logout failed", err);
        setCloudMessageKey("cloud_action_failed", { message: err.message || "" });
    } finally {
        setCloudBusy(false);
    }
}

async function loadCloudSnapshot({ silent = false } = {}) {
    if (!requireCloudUser()) return null;
    if (!silent) setCloudBusy(true);
    if (!silent) updateCloudUI("cloud_syncing");
    try {
        const userId = cloud.user.id;
        const [profileRes, progressRes, dexRes] = await Promise.all([
            cloud.client.from("fan_quest_profiles").select("user_id,level,xp,title,profile_data,updated_at").eq("user_id", userId).maybeSingle(),
            cloud.client.from("fan_quest_progress").select("id,user_id,game_slug,progress_data,updated_at").eq("user_id", userId),
            cloud.client.from("fan_quest_member_dex").select("user_id,member_id,unlocked_at,card_data").eq("user_id", userId)
        ]);

        if (profileRes.error) throw profileRes.error;
        if (progressRes.error) throw progressRes.error;
        if (dexRes.error) throw dexRes.error;

        cloud.profile = profileRes.data || null;
        cloud.progressRows = progressRes.data || [];
        cloud.dexRows = dexRes.data || [];
        const hasCloudRows = Boolean(cloud.profile || cloud.progressRows.length || cloud.dexRows.length);
        cloud.cloudSnapshot = hasCloudRows ? cloudRowsToSnapshot(cloud.profile, cloud.progressRows, cloud.dexRows) : null;

        if (!cloud.cloudSnapshot) {
            cloud.syncEnabled = true;
            if (hasLocalProgress()) {
                const saveResult = await saveCloudSnapshot({ silent: true, force: true, reason: "auto_initial_import" });
                if (saveResult?.ok && !saveResult.dexFkWarning) {
                    setCloudMessageKey("cloud_auto_imported");
                    updateCloudUI("cloud_synced");
                }
            } else {
                setCloudMessageKey("cloud_auto_sync_ready");
                updateCloudUI("cloud_save_available");
            }
            return null;
        }

        const localSnapshot = buildFanQuestSnapshot();
        const localHasProgress = hasLocalProgress();
        const differs = snapshotsDiffer(localSnapshot, cloud.cloudSnapshot);
        if (!localHasProgress) {
            applyFanQuestSnapshot(cloud.cloudSnapshot);
            cloud.syncEnabled = true;
            setCloudMessageKey("cloud_progress_loaded");
            updateCloudUI("cloud_progress_loaded");
        } else if (differs) {
            const mergedSnapshot = mergeFanQuestSnapshots(localSnapshot, cloud.cloudSnapshot);
            applyFanQuestSnapshot(mergedSnapshot);
            cloud.syncEnabled = true;
            const saveResult = await saveCloudSnapshot({ silent: true, force: true, reason: "auto_merge" });
            if (saveResult?.ok && !saveResult.dexFkWarning) {
                setCloudMessageKey("cloud_auto_merged");
                updateCloudUI("cloud_synced");
            }
        } else {
            applyFanQuestSnapshot(cloud.cloudSnapshot);
            cloud.syncEnabled = true;
            setCloudMessageKey("cloud_synced");
            updateCloudUI("cloud_synced");
        }
        return cloud.cloudSnapshot;
    } catch (err) {
        console.warn("Load cloud progress failed", err);
        setCloudMessageKey("cloud_load_failed", { message: err.message || "" });
        updateCloudUI("cloud_save_failed_local_kept");
        return null;
    } finally {
        if (!silent) setCloudBusy(false);
    }
}

async function saveCloudSnapshot({ manual = false, silent = false, force = false, reason = "manual" } = {}) {
    if (!requireCloudUser()) return;
    const snapshot = buildFanQuestSnapshot();
        if (!force && cloud.cloudSnapshot && !cloud.syncEnabled && snapshotsDiffer(snapshot, cloud.cloudSnapshot)) {
        const ok = window.confirm(t("cloud_confirm_overwrite"));
        if (!ok) {
            setCloudMessageKey("cloud_conflict_cancelled");
            updateCloudUI("cloud_unsaved_changes");
            return { ok: false, cancelled: true };
        }
    }

    if (!silent) setCloudBusy(true);
    updateCloudUI("cloud_syncing");
    try {
        cloud.dexFkWarning = false;
        const userId = cloud.user.id;
        const profilePayload = {
            user_id: userId,
            level: snapshot.level,
            xp: snapshot.xp,
            title: snapshot.title,
            profile_data: { ...snapshot, saveReason: reason },
            updated_at: snapshot.savedAt
        };

        await upsertProfileRecord(profilePayload);

        for (const row of buildProgressPayloads(snapshot)) {
            await upsertProgressRecord(row.game_slug, row.progress_data);
        }

        let dexFkWarning = false;
        if (snapshot.memberDex.length) {
            try {
                await upsertMemberDexRows(snapshot.memberDex);
            } catch (err) {
                if (!isMemberDexForeignKeyError(err)) throw err;
                dexFkWarning = true;
                console.warn("Member dex table is blocked by its member_id foreign key. Profile JSON still contains the member dex snapshot.", err);
            }
        }

        cloud.profile = profilePayload;
        cloud.cloudSnapshot = snapshot;
        cloud.dexFkWarning = dexFkWarning;
        cloud.syncEnabled = true;
        setCloudMessageKey(dexFkWarning ? "cloud_synced_dex_fk_warning" : (manual ? "cloud_saved" : "cloud_synced"));
        updateCloudUI("cloud_synced");
        return { ok: true, dexFkWarning };
    } catch (err) {
        console.warn("Save cloud progress failed", err);
        setCloudMessageKey("cloud_save_failed", { message: err.message || "" });
        updateCloudUI("cloud_save_failed_local_kept");
        return { ok: false, error: err };
    } finally {
        if (!silent) setCloudBusy(false);
    }
}

async function upsertProgressRecord(gameSlug, progressData) {
    const payload = {
        user_id: cloud.user.id,
        game_slug: gameSlug,
        progress_data: progressData,
        updated_at: new Date().toISOString()
    };
    const { error } = await cloud.client
        .from("fan_quest_progress")
        .upsert(payload, { onConflict: "user_id,game_slug" });
    if (!error) return;
    if (error.code !== "42P10") throw error;

    const existing = await cloud.client
        .from("fan_quest_progress")
        .select("id")
        .eq("user_id", payload.user_id)
        .eq("game_slug", payload.game_slug)
        .maybeSingle();
    if (existing.error) throw error;
    if (existing.data?.id) {
        const updateResult = await cloud.client
            .from("fan_quest_progress")
            .update({ progress_data: payload.progress_data, updated_at: payload.updated_at })
            .eq("id", existing.data.id);
        if (updateResult.error) throw updateResult.error;
    } else {
        const insertResult = await cloud.client.from("fan_quest_progress").insert(payload);
        if (insertResult.error) throw insertResult.error;
    }
}

async function upsertProfileRecord(profilePayload) {
    const { error } = await cloud.client
        .from("fan_quest_profiles")
        .upsert(profilePayload, { onConflict: "user_id" });
    if (!error) return;
    if (error.code !== "42P10") throw error;

    const existing = await cloud.client
        .from("fan_quest_profiles")
        .select("user_id")
        .eq("user_id", profilePayload.user_id)
        .maybeSingle();
    if (existing.error) throw error;
    if (existing.data?.user_id) {
        const updateResult = await cloud.client
            .from("fan_quest_profiles")
            .update({
                level: profilePayload.level,
                xp: profilePayload.xp,
                title: profilePayload.title,
                profile_data: profilePayload.profile_data,
                updated_at: profilePayload.updated_at
            })
            .eq("user_id", profilePayload.user_id);
        if (updateResult.error) throw updateResult.error;
    } else {
        const insertResult = await cloud.client.from("fan_quest_profiles").insert(profilePayload);
        if (insertResult.error) throw insertResult.error;
    }
}

async function upsertMemberDexRows(memberDex) {
    const rows = memberDex.map(entry => ({
        user_id: cloud.user.id,
        member_id: String(entry.member_id),
        unlocked_at: entry.unlocked_at || new Date().toISOString(),
        card_data: entry.card_data || {}
    }));
    const { error } = await cloud.client
        .from("fan_quest_member_dex")
        .upsert(rows, { onConflict: "user_id,member_id" });
    if (!error) return;
    if (error.code !== "42P10") throw error;

    for (const row of rows) {
        const existing = await cloud.client
            .from("fan_quest_member_dex")
            .select("member_id")
            .eq("user_id", row.user_id)
            .eq("member_id", row.member_id)
            .maybeSingle();
        if (existing.error) throw error;
        if (existing.data?.member_id) {
            const updateResult = await cloud.client
                .from("fan_quest_member_dex")
                .update({ card_data: row.card_data })
                .eq("user_id", row.user_id)
                .eq("member_id", row.member_id);
            if (updateResult.error) throw updateResult.error;
        } else {
            const insertResult = await cloud.client.from("fan_quest_member_dex").insert(row);
            if (insertResult.error) throw insertResult.error;
        }
    }
}

document.getElementById('langSelector').addEventListener('change', (e) => { currentLang = e.target.value; applyLang(); });

function shuffle(arr) { let a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function triggerConfetti() { 
    if (App.mode === 'challenge') return; 
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, colors: ['#FF1493', '#4CAF50', '#00FFFF'], zIndex: 9999 }); 
}

function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    if (hex && hex.length === 4) { r = parseInt(hex[1]+hex[1], 16); g = parseInt(hex[2]+hex[2], 16); b = parseInt(hex[3]+hex[3], 16); } 
    else if (hex && hex.length === 7) { r = parseInt(hex.substring(1,3), 16); g = parseInt(hex.substring(3,5), 16); b = parseInt(hex.substring(5,7), 16); }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

const App = {
    mode: '', queue: [], currentQIdx: 0, round: 0, maxRounds: 5, score: 0,
    activeGame: null, animFrame: null, timerStart: 0, timeLimit: 0, difficulty: 1,
    combo: 0, lastTarget: null, lastTime: 0, isPreloaded: false,

    init() {
        detectLang();
        this.updateHeaderStats();
        populateInstructionsModal();
        document.getElementById('btnHome').onclick = () => this.goHome();
        initCloudSave();
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('lb')) {
            try { leaderboard = JSON.parse(decodeURIComponent(escape(atob(urlParams.get('lb'))))); this.renderLeaderboard(); } catch(e) {}
        }
    },

    updateHeaderStats() {
        document.getElementById('userLevelDisplay').textContent = `Lv.${getCurrentLevel()} ${getLevelLabel(userData.totalScore)}`;
        const uniqueUnlocked = new Set(userData.unlockedIds);
        let validCount = 0;
        membersDB.forEach(m => { if (uniqueUnlocked.has(m.id)) validCount++; });
        document.getElementById('albumCountDisplay').textContent = `${validCount}/${membersDB.length}`;
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
        
        membersDB.filter(isSelectableMember).sort((a,b) => a.genNum - b.genNum).forEach(m => {
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
            this.finishLoading();
            return;
        }

        const progressEl = document.getElementById('loadingText');
        const baseText = langs[currentLang].loading || "遊戲載入中...";
        let loaded = 0;
        const total = membersDB.length;
        
        const loadPromises = membersDB.map(m => new Promise(resolve => {
            const img = new Image();
            const onLoadOrError = () => {
                loaded++;
                if (progressEl) {
                    const percent = Math.floor((loaded / total) * 100);
                    progressEl.textContent = `${baseText} (${percent}%)`;
                }
                resolve();
            };
            img.onload = () => { m.imgLoaded = true; onLoadOrError(); };
            img.onerror = () => { m.imgLoaded = true; onLoadOrError(); }; // 即使報錯也放行以防卡死
            img.src = m.image;
        }));

        const timeout = new Promise(resolve => setTimeout(resolve, 10000));
        await Promise.race([Promise.all(loadPromises), timeout]);

        this.isPreloaded = true;
        this.finishLoading();
    },

    finishLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('view-dashboard').classList.add('dashboard-blurred');
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
        let perfectThreshold = 0.85; 
        if (this.activeGame === Games.puz) perfectThreshold = 0.50; 
        else if (this.activeGame === Games.mem) perfectThreshold = 0.65; 

        if (ratio > perfectThreshold) { 
            bonus = base * 0.5;
            this.showFloatingText(langs[currentLang].msg_perfect);
        }

        const finalPoints = Math.floor((base + bonus) * multiplier * this.difficulty);
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
        div.className = 'floating-perfect'; 
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 800);
    },

    getDelay(baseMs) { return this.mode === 'challenge' ? Math.max(baseMs * 0.3, 400) : baseMs; },

    roundEndDelay(ms = 1500) {
        this.activeGame.isActive = false; cancelAnimationFrame(this.animFrame); document.getElementById('globalTimerFill').style.transform = `scaleX(0)`;
        this.delayTimeout = setTimeout(() => this.nextRound(), this.getDelay(ms));
    },

    recordCompletedSession() {
        const progress = normalizeGameProgress(userData.gameProgress);
        const now = new Date().toISOString();
        const mode = this.mode || "unknown";
        const modeEntry = {
            ...(progress.modes[mode] || {}),
            playCount: (Number(progress.modes[mode]?.playCount) || 0) + 1,
            highScore: Math.max(Number(progress.modes[mode]?.highScore) || 0, this.score),
            lastScore: this.score,
            lastPlayedAt: now,
            games: [...this.queue]
        };
        progress.modes[mode] = modeEntry;

        this.queue.forEach(gameId => {
            const gameEntry = progress.games[gameId] || {};
            progress.games[gameId] = {
                ...gameEntry,
                playCount: (Number(gameEntry.playCount) || 0) + 1,
                lastMode: mode,
                lastSessionScore: this.score,
                lastPlayedAt: now
            };
        });

        progress.totalSessions += 1;
        progress.lastPlayedAt = now;
        progress.lastMode = mode;
        progress.lastScore = this.score;
        userData.gameProgress = progress;
        saveUserData();
    },

    showFinalResult() {
        this.recordCompletedSession();
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
            let c1 = targetColorMember.colorsArray[0];
            let c2 = targetColorMember.colorsArray.length > 1 ? targetColorMember.colorsArray[1] : c1;
            grad.addColorStop(0, hexToRgba(c1, 0.85)); 
            grad.addColorStop(1, hexToRgba(c2, 0.95));
        } else {
            grad.addColorStop(0, '#e0eafc'); grad.addColorStop(0.5, '#cfdef3'); grad.addColorStop(1, '#FFB6C1');
        }
        ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
        
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
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
            shareUrl += '?lb=' + encodeURIComponent(b64);
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
            shareUrl += '?lb=' + encodeURIComponent(b64);
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
// 遊戲邏輯實作 
// ==========================================
const Games = {
    mem: {
        isActive: false, pairs: 0, flipped: [], lock: false,
        setup() {
            const c = document.getElementById('container-mem'); c.innerHTML = ''; this.pairs = 0; this.flipped = []; this.lock = false;
            let valid = getValidPool(); let m = shuffle(valid).slice(0, 8); let cards = shuffle([...m, ...m]);
            cards.forEach(mem => {
                const el = document.createElement('div'); el.className = 'mem-card'; el.dataset.id = mem.id;
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
                        App.roundEndDelay(2500); 
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
            
            setTimeout(() => {
                const hintStr = getRubyNameHTML(this.target) + (this.target.nickname ? ` (${this.target.nickname})` : "");
                document.getElementById('gameTitleHint').innerHTML = `${langs[currentLang].find_hint} <span style="color:#2196F3">${hintStr}</span>`;
            }, 10);
            
            let pool = [this.target]; while(pool.length<20) pool.push(valid[Math.floor(Math.random()*valid.length)]);
            const rect = c.getBoundingClientRect() || {width:300, height:300}; 
            const ns = window.innerWidth > 768 ? 90 : 65; 
            
            shuffle(pool).forEach(m => {
                const el = document.createElement('div'); el.className = 'fly-node'; el.dataset.id = m.id;
                el.style.width=el.style.height=ns+'px'; el.innerHTML = `<img src="${m.image}">`; 
                let x=Math.random()*(rect.width-ns), y=Math.random()*(rect.height-ns), a=Math.random()*Math.PI*2;
                
                let baseSpeed = Math.min(rect.width * 0.003, 1.8);
                let s = baseSpeed * (Math.random() * 0.5 + 0.8) * App.difficulty;
                
                el.style.transform = `translate(${x}px, ${y}px)`;
                el.onclick = (e) => {
                    e.stopPropagation(); if(!this.isActive) return; 
                    if(m.id===this.target.id) { 
                        this.isActive=false; el.classList.add('correct'); c.classList.add('dimmed'); 
                        el.style.transform = `translate(${rect.width/2 - ns/2}px, ${rect.height/2 - ns/2}px) scale(2)`;
                        let c1 = m.colorsArray[0] || '#FF4081', c2 = m.colorsArray[1] || c1;
                        el.style.boxShadow = `0 0 40px ${c1}, inset 0 0 20px ${c2}`;
                        App.addScore(1000, 1-(performance.now()-App.timerStart)/App.timeLimit); App.roundEndDelay(2500); 
                    } else { App.combo = 0; App.score = Math.max(0, App.score-50); document.getElementById('scoreDisplay').textContent=App.score; el.style.borderColor='red'; setTimeout(()=>el.style.borderColor='#fff', 300); }
                }; c.appendChild(el); this.nodes.push({el, x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, size:ns});
            });
        }, 
        onFrame(p, dt) {
            const rect = document.getElementById('container-find').getBoundingClientRect();
            const timeScale = dt / 16.66;
            this.nodes.forEach(n => { 
                n.x += n.vx * timeScale; 
                n.y += n.vy * timeScale; 
                if(n.x<=0||n.x+n.size>=rect.width) n.vx*=-1; 
                if(n.y<=0||n.y+n.size>=rect.height) n.vy*=-1; 
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
            const cDisplay = document.getElementById('colorDisplay'), opts = document.getElementById('colorOpts'); 
            cDisplay.innerHTML = ''; opts.innerHTML = '';
            
            let valid = getValidPool(); this.target = valid[Math.floor(Math.random() * valid.length)]; App.lastTarget = this.target;
            const tColorsStr = [...this.target.colorsArray].sort().join(',');
            
            let validPool = valid.filter(m => m.id !== this.target.id && [...m.colorsArray].sort().join(',') !== tColorsStr);
            if(validPool.length < 3) validPool = valid.filter(m => m.id !== this.target.id);
            
            cDisplay.innerHTML = this.target.colorsArray.map(c => `<div class="color-chunk" style="background-color:${c}; border: 3px solid #fff; border-radius: 12px; box-shadow: inset 0 0 10px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1);"></div>`).join('');
            let pool = shuffle([this.target, ...shuffle(validPool).slice(0,3)]);
            
            pool.forEach(m => {
                const b = document.createElement('button'); b.className = 'opt-btn'; b.dataset.id = m.id; b.innerHTML = getRubyNameHTML(m);
                b.onclick = () => { 
                    if(!this.isActive) return; this.isActive=false; 
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); } 
                    else { App.combo = 0; b.classList.add('wrong'); Array.from(opts.children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); }
                    App.roundEndDelay(2000); 
                }; opts.appendChild(b);
            });
        },
        onTimeOut() { Array.from(document.getElementById('colorOpts').children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); App.roundEndDelay(1500); }
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
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); } 
                    else { App.combo = 0; b.classList.add('wrong'); Array.from(opts.children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); }
                    App.roundEndDelay(2500); 
                }; opts.appendChild(b);
            });
        }, 
        onFrame(p) { document.getElementById('macroImg').style.transform = `scale(${this.zoom - ((this.zoom-1)*p)}) translate(${this.px*(1-p)}%, ${this.py*(1-p)}%)`; },
        onTimeOut() { 
            document.getElementById('macroImg').style.transition = `transform ${App.getDelay(600)}ms ease`; 
            document.getElementById('macroImg').style.transform = 'scale(1) translate(0,0)'; 
            Array.from(document.getElementById('macroOpts').children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); 
            App.roundEndDelay(2000); 
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
                    if(!this.isActive) return; this.isActive=false; 
                    const win = (i===0&&m1.genNum<m2.genNum)||(i===1&&m2.genNum<m1.genNum);
                    c.querySelectorAll('.duel-card').forEach(x => {
                        x.classList.add('revealed');
                        if(x.dataset.id === App.lastTarget.id) x.classList.add('correct');
                        else if(x === el) x.classList.add('wrong');
                    }); 
                    if(win) App.addScore(600, 1-(performance.now()-App.timerStart)/App.timeLimit); 
                    else { App.combo = 0; c.style.animation='shake 0.4s'; }
                    App.roundEndDelay(1500);
                }; c.appendChild(el);
            });
        }, onTimeOut() { 
            const c = document.getElementById('container-duel');
            c.querySelectorAll('.duel-card').forEach(x => {
                x.classList.add('revealed');
                if(x.dataset.id === App.lastTarget.id) x.classList.add('correct');
                else x.classList.add('wrong');
            });
            App.roundEndDelay(1500); 
        }
    },
    smile: {
        isActive: false, mx: 50, my: 50, vx: 0.5, vy: 0.5, baseMask: 65,
        setup() {
            const view = document.getElementById('smileView'), opts = document.getElementById('smileOpts'); opts.innerHTML = '';
            view.classList.remove('revealed'); let valid = getValidPool(); let pool = shuffle(valid).slice(0,4); this.target = pool[0]; App.lastTarget = this.target;
            
            const frosted = document.getElementById('smileFrosted');
            frosted.style.transition = 'none';
            
            this.baseMask = Math.max(50 - (App.difficulty * 5), 25);
            this.mx = 30+Math.random()*40; this.my = 30+Math.random()*40;
            this.vx = (Math.random()-0.5)*1.2; this.vy = (Math.random()-0.5)*1.2;
            
            view.style.setProperty('--mask-x', this.mx+'%'); view.style.setProperty('--mask-y', this.my+'%');
            view.style.setProperty('--mask-size', `${this.baseMask}px`);
            void view.offsetWidth;
            
            document.getElementById('smileSharp').src = this.target.image;

            shuffle(pool).forEach(m => {
                const b = document.createElement('button'); b.className = 'opt-btn'; b.dataset.id = m.id; b.innerHTML = getRubyNameHTML(m);
                b.onclick = () => { 
                    if(!this.isActive) return; this.isActive=false; view.classList.add('revealed'); 
                    if(m.id===this.target.id) { b.classList.add('correct'); App.addScore(800, 1-(performance.now()-App.timerStart)/App.timeLimit); } 
                    else { App.combo = 0; b.classList.add('wrong'); Array.from(opts.children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); }
                    App.roundEndDelay(2500); 
                }; opts.appendChild(b);
            });
        }, 
        onFrame(p, dt) {
            const timeScale = dt / 16.66;
            this.mx += this.vx * timeScale; 
            this.my += this.vy * timeScale; 
            if(this.mx<20||this.mx>80) this.vx*=-1; 
            if(this.my<20||this.my>80) this.vy*=-1;
            const v = document.getElementById('smileView'); v.style.setProperty('--mask-x', this.mx+'%'); v.style.setProperty('--mask-y', this.my+'%');
            v.style.setProperty('--mask-size', `${this.baseMask * (1 - (p * 0.3))}px`);
        }, 
        onTimeOut() { document.getElementById('smileView').classList.add('revealed'); Array.from(document.getElementById('smileOpts').children).find(x=>x.dataset.id===this.target.id)?.classList.add('correct'); App.roundEndDelay(2000); }
    },
    puz: {
        isActive: false, state: [], sel: null, target: null,
        setup() {
            const c = document.getElementById('puzGrid'); Array.from(c.children).forEach(x=>{if(x.id!=='puzOverlay') x.remove();}); 
            document.getElementById('puzOverlay').style.opacity = 0;
            let valid = getValidPool(); this.target = valid[Math.floor(Math.random()*valid.length)]; document.getElementById('puzOverlay').src = this.target.image; this.state = []; this.sel = null;
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
        check() { if(this.state.every(p=>p.id===p.pos && p.rot===0)) { this.isActive=false; document.getElementById('puzOverlay').style.opacity = 1; App.addScore(1200, 1-(performance.now()-App.timerStart)/App.timeLimit); App.roundEndDelay(2500); } },
        onTimeOut() { document.getElementById('puzOverlay').style.opacity = 1; App.roundEndDelay(2000); }
    }
};

window.onload = loadData;
